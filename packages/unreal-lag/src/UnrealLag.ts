import * as dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import type { AddressInfo } from 'node:net';

import { hasPriorityMarker } from './priority';
import { UnrealLagProfiles } from './profiles';
import { RandomSource } from './random';
import { evaluateRoute, resolvePeerSelection } from './resolve';
import { PacketScheduler, type ScheduledItem } from './scheduler';
import type {
  BindInfo,
  PeerEndpoint,
  PeerKind,
  PeerSelection,
  PeerStats,
  ResolvedPeerConfig,
  RuntimePeerSummary,
  UnrealLagLogger,
  UnrealLagOptions,
  UnrealLagStatsSnapshot,
} from './types';

interface RuntimePeer {
  id: string;
  kind: PeerKind;
  endpoint?: PeerEndpoint;
  config: ResolvedPeerConfig;
  generation: number;
  active: boolean;
  upstreamSocket?: dgram.Socket;
}

interface ScheduledDatagram {
  senderPeerId: string;
  senderGeneration: number;
  receiverPeerId: string;
  receiverGeneration: number;
  viaSocket: dgram.Socket;
  destinationAddress: string;
  destinationPort: number;
  payload: Buffer;
}

function endpointKey(endpoint: PeerEndpoint): string {
  return `${endpoint.address}:${endpoint.port}`;
}

function closeSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    try {
      socket.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

function bindSocket(socket: dgram.Socket, port: number, address: string): Promise<BindInfo> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      socket.off('error', onError);
      const info = socket.address() as AddressInfo;
      resolve({ address: info.address, port: info.port });
    };
    socket.once('error', onError);
    socket.once('listening', onListening);
    socket.bind(port, address);
  });
}

function createEmptyPeerStats(): PeerStats {
  return { received: 0, forwarded: 0, dropped: 0, duplicated: 0 };
}

export class UnrealLag extends EventEmitter {
  private readonly logger: UnrealLagLogger;
  private readonly random: RandomSource;
  private readonly scheduler: PacketScheduler<ScheduledDatagram>;
  private readonly peers = new Map<string, RuntimePeer>();
  private readonly clientEndpointToPeerId = new Map<string, string>();
  private readonly socketToPeerId = new Map<dgram.Socket, string>();
  private readonly peerStats = new Map<string, PeerStats>();
  private readonly profiles;
  private readonly serverId: string;

  private listenSocket?: dgram.Socket;
  private started = false;
  private nextDynamicClientId = 1;

  private readonly stats = {
    received: 0,
    forwarded: 0,
    dropped: 0,
    duplicated: 0,
    scheduled: 0,
    released: 0,
    peerAdded: 0,
    peerRemoved: 0,
    droppedUnknownPeer: 0,
    droppedPeerRemoved: 0,
  };

  constructor(private readonly options: UnrealLagOptions) {
    super();
    this.logger = options.logger ?? console;
    this.random = new RandomSource(options.randomSeed);
    this.scheduler = new PacketScheduler<ScheduledDatagram>((item) => {
      void this.releaseScheduledItem(item);
    });
    this.profiles = options.profiles ? { ...UnrealLagProfiles, ...options.profiles } : UnrealLagProfiles;
    this.serverId = options.server.id ?? 'server';
  }

  private log(message: string, ...args: unknown[]) {
    this.logger.log(`[UnrealLag] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]) {
    this.logger.warn(`[UnrealLag] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]) {
    this.logger.error(`[UnrealLag] ${message}`, ...args);
  }

  private formatEndpoint(endpoint?: PeerEndpoint | BindInfo) {
    return endpoint ? `${endpoint.address}:${endpoint.port}` : '<unbound>';
  }

  private getProxyIngressBindInfo(): BindInfo | undefined {
    if (!this.listenSocket) return undefined;
    const info = this.listenSocket.address() as AddressInfo;
    return { address: info.address, port: info.port };
  }

  private getProxyEgressBindInfo(peer: RuntimePeer): BindInfo | undefined {
    if (!peer.upstreamSocket) return undefined;
    const info = peer.upstreamSocket.address() as AddressInfo;
    return { address: info.address, port: info.port };
  }

  private describePeer(peer: RuntimePeer) {
    const proxyIngress = this.getProxyIngressBindInfo();
    const proxyEgress = this.getProxyEgressBindInfo(peer);
    const parts = [
      `kind=${peer.kind}`,
      `id=${peer.id}`,
      `real=${this.formatEndpoint(peer.endpoint)}`,
      `proxyIngress=${this.formatEndpoint(proxyIngress)}`,
    ];

    if (proxyEgress) {
      parts.push(`proxyEgress=${this.formatEndpoint(proxyEgress)}`);
    }

    if (peer.kind === 'server') {
      parts.push('direction=proxy->real-server');
    } else {
      parts.push('direction=client->proxy->server');
    }

    return parts.join(' | ');
  }

  private logPeerEvent(eventName: 'peerAdded' | 'peerRemoved' | 'clientAutoCreated', peer: RuntimePeer) {
    this.log(`${eventName} | ${this.describePeer(peer)}`);
  }

  async start(): Promise<BindInfo> {
    if (this.started) {
      return this.getBindInfo();
    }

    this.listenSocket = dgram.createSocket('udp4');
    this.listenSocket.on('message', (message, rinfo) => {
      void this.handleClientMessage(message, { address: rinfo.address, port: rinfo.port });
    });
    this.listenSocket.on('error', (error) => {
      this.error(
        `error | kind=proxy-listener | proxyIngress=${this.formatEndpoint(this.getProxyIngressBindInfo())}`,
        error,
      );
      this.emit('error', error);
    });

    const bindInfo = await bindSocket(
      this.listenSocket,
      this.options.bindPort,
      this.options.bindAddress ?? '127.0.0.1',
    );
    this.log(`startup | proxy listener bound | kind=proxy | proxyIngress=${this.formatEndpoint(bindInfo)}`);

    const serverPeer: RuntimePeer = {
      id: this.serverId,
      kind: 'server',
      endpoint: { address: this.options.server.address, port: this.options.server.port },
      config: resolvePeerSelection(this.serverId, this.options.server.selection, this.profiles),
      generation: 0,
      active: true,
    };
    this.peers.set(serverPeer.id, serverPeer);
    this.peerStats.set(serverPeer.id, createEmptyPeerStats());
    this.stats.peerAdded += 1;
    this.logPeerEvent('peerAdded', serverPeer);
    this.emit('peerAdded', this.summarizePeer(serverPeer));

    for (const [peerId, selection] of Object.entries(this.options.predefinedClients ?? {})) {
      this.registerClient(peerId, selection);
    }

    this.scheduler.start();
    this.started = true;
    this.log(
      `startup complete | proxy ready | proxyIngress=${this.formatEndpoint(bindInfo)} | realServer=${this.formatEndpoint(serverPeer.endpoint)}`,
    );
    return bindInfo;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.log(
      `shutdown | stopping proxy | proxyIngress=${this.formatEndpoint(this.getProxyIngressBindInfo())} | peers=${this.peers.size}`,
    );

    this.scheduler.stop();

    const socketsToClose: dgram.Socket[] = [];
    if (this.listenSocket) {
      socketsToClose.push(this.listenSocket);
      this.listenSocket = undefined;
    }
    for (const peer of this.peers.values()) {
      if (peer.upstreamSocket) {
        socketsToClose.push(peer.upstreamSocket);
      }
    }

    this.socketToPeerId.clear();
    this.clientEndpointToPeerId.clear();
    this.peers.clear();

    for (const socket of socketsToClose) {
      await closeSocket(socket);
    }
    this.log('shutdown complete | proxy sockets closed');
  }

  getBindInfo(): BindInfo {
    if (!this.listenSocket) {
      throw new Error('UnrealLag is not started');
    }
    const info = this.listenSocket.address() as AddressInfo;
    return { address: info.address, port: info.port };
  }

  listPeers(): RuntimePeerSummary[] {
    return Array.from(this.peers.values()).map((peer) => this.summarizePeer(peer));
  }

  getStats(): UnrealLagStatsSnapshot {
    const peers: Record<string, PeerStats> = {};
    for (const [peerId, stats] of this.peerStats.entries()) {
      peers[peerId] = { ...stats };
    }
    return {
      ...this.stats,
      peers,
    };
  }

  registerClient(peerId: string, selection?: PeerSelection): RuntimePeerSummary {
    const existing = this.peers.get(peerId);
    if (existing) {
      existing.config = resolvePeerSelection(peerId, selection, this.profiles);
      this.log(`peerUpdated | ${this.describePeer(existing)}`);
      return this.summarizePeer(existing);
    }

    const clientPeer: RuntimePeer = {
      id: peerId,
      kind: 'client',
      config: resolvePeerSelection(peerId, selection ?? this.options.defaultClient, this.profiles),
      generation: 0,
      active: true,
    };
    this.peers.set(peerId, clientPeer);
    this.peerStats.set(peerId, createEmptyPeerStats());
    this.stats.peerAdded += 1;
    const summary = this.summarizePeer(clientPeer);
    this.logPeerEvent('peerAdded', clientPeer);
    this.emit('peerAdded', summary);
    return summary;
  }

  updatePeer(peerId: string, selection: PeerSelection): RuntimePeerSummary | undefined {
    const peer = this.peers.get(peerId);
    if (!peer) return undefined;
    peer.config = resolvePeerSelection(peerId, selection, this.profiles);
    this.log(`peerUpdated | ${this.describePeer(peer)}`);
    return this.summarizePeer(peer);
  }

  async removePeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    this.logPeerEvent('peerRemoved', peer);

    peer.active = false;
    peer.generation += 1;
    this.stats.peerRemoved += 1;

    if (peer.endpoint) {
      this.clientEndpointToPeerId.delete(endpointKey(peer.endpoint));
    }
    if (peer.upstreamSocket) {
      this.socketToPeerId.delete(peer.upstreamSocket);
      await closeSocket(peer.upstreamSocket);
      peer.upstreamSocket = undefined;
    }

    this.peers.delete(peerId);
    this.emit('peerRemoved', { id: peerId });
    return true;
  }

  private summarizePeer(peer: RuntimePeer): RuntimePeerSummary {
    return {
      id: peer.id,
      kind: peer.kind,
      endpoint: peer.endpoint,
      generation: peer.generation,
      active: peer.active,
    };
  }

  private getOrCreatePeerStats(peerId: string): PeerStats {
    let stats = this.peerStats.get(peerId);
    if (!stats) {
      stats = createEmptyPeerStats();
      this.peerStats.set(peerId, stats);
    }
    return stats;
  }

  private async handleClientMessage(message: Buffer, endpoint: PeerEndpoint) {
    this.stats.received += 1;

    const clientPeer = await this.getOrCreateClientPeer(endpoint);
    if (!clientPeer) {
      this.warn(`drop | reason=unknownClient | kind=client-packet | real=${this.formatEndpoint(endpoint)}`);
      this.stats.dropped += 1;
      this.stats.droppedUnknownPeer += 1;
      return;
    }

    this.getOrCreatePeerStats(clientPeer.id).received += 1;

    const serverPeer = this.peers.get(this.serverId);
    if (!serverPeer?.endpoint) {
      this.warn(
        `drop | reason=serverUnavailable | kind=client-packet | sender=${clientPeer.id} | proxyIngress=${this.formatEndpoint(this.getProxyIngressBindInfo())}`,
      );
      this.stats.dropped += 1;
      this.stats.droppedUnknownPeer += 1;
      return;
    }

    const upstreamSocket = clientPeer.upstreamSocket;
    if (!upstreamSocket) {
      this.warn(`drop | reason=clientProxyEgressUnavailable | kind=client-packet | ${this.describePeer(clientPeer)}`);
      this.stats.dropped += 1;
      this.stats.droppedUnknownPeer += 1;
      return;
    }

    this.routePacket(
      clientPeer,
      serverPeer,
      message,
      upstreamSocket,
      serverPeer.endpoint.address,
      serverPeer.endpoint.port,
    );
  }

  private async handleServerMessage(clientPeerId: string, message: Buffer, remote: PeerEndpoint) {
    this.stats.received += 1;

    const serverPeer = this.peers.get(this.serverId);
    const clientPeer = this.peers.get(clientPeerId);
    if (!serverPeer || !clientPeer?.endpoint || !this.listenSocket) {
      this.warn(
        `drop | reason=missingPeerState | kind=server-packet | senderReal=${this.formatEndpoint(remote)} | targetClientId=${clientPeerId}`,
      );
      this.stats.dropped += 1;
      this.stats.droppedUnknownPeer += 1;
      return;
    }

    if (
      serverPeer.endpoint &&
      (remote.address !== serverPeer.endpoint.address || remote.port !== serverPeer.endpoint.port)
    ) {
      this.warn(
        `drop | reason=unexpectedServerEndpoint | expected=${this.formatEndpoint(serverPeer.endpoint)} | actual=${this.formatEndpoint(remote)}`,
      );
      this.stats.dropped += 1;
      this.stats.droppedUnknownPeer += 1;
      return;
    }

    this.getOrCreatePeerStats(serverPeer.id).received += 1;
    this.routePacket(
      serverPeer,
      clientPeer,
      message,
      this.listenSocket,
      clientPeer.endpoint.address,
      clientPeer.endpoint.port,
    );
  }

  private routePacket(
    sender: RuntimePeer,
    receiver: RuntimePeer,
    payload: Buffer,
    viaSocket: dgram.Socket,
    destinationAddress: string,
    destinationPort: number,
  ) {
    if (hasPriorityMarker(payload)) {
      this.log(`priorityBypass | sender=${sender.id} | receiver=${receiver.id} | bytes=${payload.length}`);
      void this.sendImmediately(sender, receiver, viaSocket, payload, destinationAddress, destinationPort);
      return;
    }

    const decision = evaluateRoute(sender.config, receiver.config, this.random);
    if (decision.drop) {
      this.stats.dropped += 1;
      this.getOrCreatePeerStats(sender.id).dropped += 1;
      return;
    }

    if (decision.duplicateCount > 1) {
      this.stats.duplicated += decision.duplicateCount - 1;
      this.getOrCreatePeerStats(sender.id).duplicated += decision.duplicateCount - 1;
    }

    for (let i = 0; i < decision.duplicateCount; i++) {
      const freshDecision = i === 0 ? decision : evaluateRoute(sender.config, receiver.config, this.random);
      if (i > 0 && freshDecision.drop) {
        this.stats.dropped += 1;
        this.getOrCreatePeerStats(sender.id).dropped += 1;
        continue;
      }

      const releaseAtMs = Date.now() + freshDecision.totalDelayMs;
      this.scheduler.enqueue(releaseAtMs, {
        senderPeerId: sender.id,
        senderGeneration: sender.generation,
        receiverPeerId: receiver.id,
        receiverGeneration: receiver.generation,
        viaSocket,
        destinationAddress,
        destinationPort,
        payload: Buffer.from(payload),
      });
      this.stats.scheduled += 1;
    }
  }

  private async sendImmediately(
    sender: RuntimePeer,
    receiver: RuntimePeer,
    viaSocket: dgram.Socket,
    payload: Buffer,
    destinationAddress: string,
    destinationPort: number,
  ) {
    await new Promise<void>((resolve) => {
      viaSocket.send(Buffer.from(payload), destinationPort, destinationAddress, (error) => {
        if (error) {
          this.error(
            `error | kind=prioritySendFailed | sender=${sender.id} | receiver=${receiver.id} | destination=${destinationAddress}:${destinationPort}`,
            error,
          );
          this.stats.dropped += 1;
        } else {
          this.stats.forwarded += 1;
          this.getOrCreatePeerStats(sender.id).forwarded += 1;
        }
        resolve();
      });
    });
  }

  private async releaseScheduledItem(item: ScheduledItem<ScheduledDatagram>) {
    this.stats.released += 1;
    const payload = item.payload;

    const sender = this.peers.get(payload.senderPeerId);
    const receiver = this.peers.get(payload.receiverPeerId);
    if (
      !sender ||
      !receiver ||
      sender.generation !== payload.senderGeneration ||
      receiver.generation !== payload.receiverGeneration
    ) {
      this.warn(
        `drop | reason=peerRemovedWhileScheduled | sender=${payload.senderPeerId} | receiver=${payload.receiverPeerId}`,
      );
      this.stats.dropped += 1;
      this.stats.droppedPeerRemoved += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      payload.viaSocket.send(payload.payload, payload.destinationPort, payload.destinationAddress, (error) => {
        if (error) {
          this.error(
            `error | kind=sendFailed | sender=${sender.id} | receiver=${receiver.id} | destination=${payload.destinationAddress}:${payload.destinationPort}`,
            error,
          );
          this.stats.dropped += 1;
        } else {
          this.stats.forwarded += 1;
          this.getOrCreatePeerStats(sender.id).forwarded += 1;
        }
        resolve();
      });
    });
  }

  private async getOrCreateClientPeer(endpoint: PeerEndpoint): Promise<RuntimePeer | undefined> {
    const existingId = this.clientEndpointToPeerId.get(endpointKey(endpoint));
    if (existingId) {
      return this.peers.get(existingId);
    }

    if (this.options.autoCreateClients === false) {
      return undefined;
    }

    const preconfiguredPeer = Array.from(this.peers.values()).find((peer) => peer.kind === 'client' && !peer.endpoint);

    const peerId = preconfiguredPeer?.id ?? `client-${this.nextDynamicClientId++}`;
    if (!preconfiguredPeer) {
      this.registerClient(peerId, this.options.defaultClient);
    }
    const runtimePeer = this.peers.get(peerId);
    if (!runtimePeer) {
      return undefined;
    }
    runtimePeer.endpoint = endpoint;

    const upstreamSocket = dgram.createSocket('udp4');
    upstreamSocket.on('message', (message, rinfo) => {
      void this.handleServerMessage(runtimePeer.id, message, { address: rinfo.address, port: rinfo.port });
    });
    upstreamSocket.on('error', (error) => {
      this.error(`error | kind=clientProxyEgress | ${this.describePeer(runtimePeer)}`, error);
      this.emit('error', error);
    });

    await bindSocket(upstreamSocket, 0, this.options.bindAddress ?? '127.0.0.1');
    runtimePeer.upstreamSocket = upstreamSocket;

    this.socketToPeerId.set(upstreamSocket, runtimePeer.id);
    this.clientEndpointToPeerId.set(endpointKey(endpoint), runtimePeer.id);
    this.logPeerEvent('clientAutoCreated', runtimePeer);
    this.emit('clientAutoCreated', this.summarizePeer(runtimePeer));
    return runtimePeer;
  }
}
