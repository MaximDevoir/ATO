import { once } from 'node:events';
import type { SocketAddress } from 'node:net';
import net from 'node:net';
import type { ATIConsumerBackpressure, ATIContext, IATIConsumer } from './ATIConsumer';
import type { ATCEvent } from './ATIEvents';
import { parseATCEvent } from './validation';

export type ATIServiceOptions = {
  host: string;
  port: number;
  maxEventSizeBytes?: number;
  validateSchema?: boolean;
};

type SessionState = {
  sessionId: string;
  startTime: number;
  lastSequence: number;
};

function deferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

class ATIConsumerPump {
  private readonly queue: ATCEvent[] = [];
  private readonly strategy: NonNullable<ATIConsumerBackpressure['strategy']>;
  private readonly maxQueueSize: number;
  private processing = false;
  private pendingSpaceResolvers: Array<() => void> = [];

  constructor(private readonly consumer: IATIConsumer) {
    this.strategy = consumer.backpressure?.strategy ?? 'block';
    this.maxQueueSize = Math.max(1, consumer.backpressure?.maxQueueSize ?? 1024);
  }

  async onSessionStart(ctx: ATIContext) {
    await this.consumer.onStart?.(ctx);
  }

  async enqueue(event: ATCEvent) {
    if (this.consumer.isReady && !this.consumer.isReady()) {
      return;
    }

    while (this.queue.length >= this.maxQueueSize) {
      if (this.strategy === 'drop-newest') {
        return;
      }

      if (this.strategy === 'drop-oldest') {
        this.queue.shift();
        break;
      }

      const deferred = deferredPromise();
      this.pendingSpaceResolvers.push(deferred.resolve);
      await deferred.promise;
    }

    this.queue.push(event);
    await this.processQueue();
  }

  async flush() {
    await this.processQueue();
    while (this.processing || this.queue.length > 0) {
      const deferred = deferredPromise();
      this.pendingSpaceResolvers.push(deferred.resolve);
      await deferred.promise;
      await this.processQueue();
    }
  }

  async onSessionEnd(ctx: ATIContext) {
    await this.flush();
    await this.consumer.onEnd?.(ctx);
  }

  async dispose() {
    await this.flush();
    await this.consumer.dispose?.();
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        this.signalQueueAdvanced();
        if (!event) {
          continue;
        }

        await this.consumer.onEvent(event);
      }
    } finally {
      this.processing = false;
      this.signalQueueAdvanced();
    }
  }

  private signalQueueAdvanced() {
    const resolvers = this.pendingSpaceResolvers;
    this.pendingSpaceResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}

export class ATIService {
  private readonly consumers = new Map<string, ATIConsumerPump>();
  private readonly sockets = new Set<net.Socket>();
  private server?: net.Server;
  private currentSession?: SessionState;
  private started = false;

  constructor(private readonly options: ATIServiceOptions) {}

  addConsumer(consumer: IATIConsumer) {
    if (this.consumers.has(consumer.id)) {
      throw new Error(`ATI consumer '${consumer.id}' is already registered`);
    }

    this.consumers.set(consumer.id, new ATIConsumerPump(consumer));
    return this;
  }

  async start() {
    if (this.started) {
      return;
    }

    this.server = net.createServer((socket) => {
      this.sockets.add(socket);
      socket.setEncoding('utf8');

      let buffer = '';
      socket.on('data', async (chunk: string) => {
        buffer += chunk;

        if (this.options.maxEventSizeBytes && Buffer.byteLength(buffer, 'utf8') > this.options.maxEventSizeBytes) {
          socket.destroy(new Error(`ATI event buffer exceeded ${this.options.maxEventSizeBytes} bytes`));
          return;
        }

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!line) {
            continue;
          }

          try {
            const event = this.options.validateSchema === false ? (JSON.parse(line) as ATCEvent) : parseATCEvent(line);
            await this.publish(event);
          } catch (error) {
            console.error(error instanceof Error ? error.message : error);
          }
        }
      });

      socket.once('close', () => {
        this.sockets.delete(socket);
      });
    });

    this.server.listen(this.options.port, this.options.host);
    await once(this.server, 'listening');
    this.started = true;
  }

  getEndpoint() {
    if (!this.server) {
      throw new Error('ATI service is not started');
    }

    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('ATI service did not bind to a TCP socket address');
    }

    const socketAddress = address as SocketAddress;
    return {
      host: socketAddress.address,
      port: socketAddress.port,
    };
  }

  async stop() {
    if (!this.started) {
      return;
    }

    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();

    if (this.currentSession) {
      const ctx = {
        sessionId: this.currentSession.sessionId,
        startTime: this.currentSession.startTime,
      } satisfies ATIContext;
      for (const pump of this.consumers.values()) {
        await pump.onSessionEnd(ctx);
      }
      this.currentSession = undefined;
    }

    if (this.server) {
      this.server.close();
      await once(this.server, 'close');
      this.server = undefined;
    }

    for (const pump of this.consumers.values()) {
      await pump.dispose();
    }

    this.started = false;
  }

  private async publish(event: ATCEvent) {
    await this.ensureSession(event.sessionId, event.sequence);
    if (this.currentSession) {
      if (event.sequence !== this.currentSession.lastSequence + 1) {
        console.warn(
          `ATI sequence gap for session '${event.sessionId}': expected ${this.currentSession.lastSequence + 1}, got ${event.sequence}`,
        );
      }
      this.currentSession.lastSequence = event.sequence;
    }

    for (const pump of this.consumers.values()) {
      await pump.enqueue(event);
    }
  }

  private async ensureSession(sessionId: string, sequence: number) {
    if (!this.currentSession) {
      this.currentSession = {
        sessionId,
        startTime: Date.now(),
        lastSequence: sequence - 1,
      };
      const ctx = { sessionId, startTime: this.currentSession.startTime } satisfies ATIContext;
      for (const pump of this.consumers.values()) {
        await pump.onSessionStart(ctx);
      }
      return;
    }

    if (this.currentSession.sessionId === sessionId) {
      return;
    }

    const previous = this.currentSession;
    const previousCtx = { sessionId: previous.sessionId, startTime: previous.startTime } satisfies ATIContext;
    for (const pump of this.consumers.values()) {
      await pump.onSessionEnd(previousCtx);
    }

    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      lastSequence: sequence - 1,
    };
    const nextCtx = { sessionId, startTime: this.currentSession.startTime } satisfies ATIContext;
    for (const pump of this.consumers.values()) {
      await pump.onSessionStart(nextCtx);
    }
  }
}
