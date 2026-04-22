import type { DownloadStatusSnapshot } from '../contracts/StatusStreamTypes.js';
import type { SlotTable } from './SlotTable.js';

/**
 * Minimal async-iterable broadcaster of status snapshots.
 *
 * The Installer owns the `SlotTable` and calls `publish()` after every
 * state mutation. Consumers (e.g. Ink views) iterate via
 * `for await (const snap of stream)`.
 *
 * This is intentionally a simple "latest-wins" queue — we do not buffer
 * historical snapshots.
 */
export class StatusStream implements AsyncIterable<DownloadStatusSnapshot> {
  private pending: DownloadStatusSnapshot | null = null;
  private readonly waiters: Array<(snap: IteratorResult<DownloadStatusSnapshot>) => void> = [];
  private closed = false;

  constructor(private readonly table: SlotTable) {}

  publish(): void {
    if (this.closed) return;
    const snap = this.table.snapshot();
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: snap, done: false });
      return;
    }
    this.pending = snap;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    // Flush any waiting iterators
    while (this.waiters.length > 0) {
      const w = this.waiters.shift();
      w?.({ value: undefined as unknown as DownloadStatusSnapshot, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<DownloadStatusSnapshot> {
    return {
      next: (): Promise<IteratorResult<DownloadStatusSnapshot>> => {
        if (this.pending) {
          const v = this.pending;
          this.pending = null;
          return Promise.resolve({ value: v, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as DownloadStatusSnapshot, done: true });
        }
        return new Promise((resolve) => this.waiters.push(resolve));
      },
      return: (): Promise<IteratorResult<DownloadStatusSnapshot>> => {
        this.close();
        return Promise.resolve({ value: undefined as unknown as DownloadStatusSnapshot, done: true });
      },
    };
  }
}
