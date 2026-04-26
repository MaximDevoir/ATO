import { compareSequence, SequenceCounter, type SequenceId } from './sequence.js';

export interface ScheduledItem<T> {
  releaseAtMs: number;
  order: SequenceId;
  payload: T;
}

function compareScheduled<T>(a: ScheduledItem<T>, b: ScheduledItem<T>): number {
  if (a.releaseAtMs !== b.releaseAtMs) {
    return a.releaseAtMs - b.releaseAtMs;
  }
  return compareSequence(a.order, b.order);
}

class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  size() {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  clear() {
    this.items.length = 0;
  }

  push(item: T) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last as T;
      this.bubbleDown(0);
    }
    return first;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) >= 0) return;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    const length = this.items.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < length && this.compare(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) return;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

export class PacketScheduler<T> {
  private readonly heap = new MinHeap<ScheduledItem<T>>(compareScheduled);
  private readonly sequence = new SequenceCounter();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly onRelease: (item: ScheduledItem<T>) => void) {}

  start() {
    this.running = true;
    this.rearm();
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.heap.clear();
  }

  size() {
    return this.heap.size();
  }

  enqueue(releaseAtMs: number, payload: T): ScheduledItem<T> {
    const item: ScheduledItem<T> = {
      releaseAtMs,
      order: this.sequence.next(),
      payload,
    };
    this.heap.push(item);
    this.rearm();
    return item;
  }

  clear() {
    this.heap.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private rearm() {
    if (!this.running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const head = this.heap.peek();
    if (!head) return;

    const waitMs = Math.max(0, head.releaseAtMs - Date.now());
    this.timer = setTimeout(() => this.drainReady(), waitMs);
  }

  private drainReady() {
    this.timer = null;
    const now = Date.now();
    while (true) {
      const head = this.heap.peek();
      if (!head || head.releaseAtMs > now) break;
      const item = this.heap.pop() as ScheduledItem<T>;
      this.onRelease(item);
    }
    this.rearm();
  }
}
