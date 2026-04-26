import type { ATCEvent } from './ATIEvents.js';

export type ATIContext = {
  sessionId: string;
  startTime: number;
};

export type ATIConsumerBackpressure = {
  maxQueueSize?: number;
  strategy?: 'block' | 'drop-oldest' | 'drop-newest';
};

export interface IATIConsumer {
  readonly id: string;
  onStart?(ctx: ATIContext): Promise<void> | void;
  onEvent(event: ATCEvent): Promise<void> | void;
  onEnd?(ctx: ATIContext): Promise<void> | void;
  isReady?(): boolean;
  dispose?(): Promise<void> | void;
  backpressure?: ATIConsumerBackpressure;
}
