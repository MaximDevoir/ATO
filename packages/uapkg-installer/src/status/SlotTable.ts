import type { DownloadStatusSnapshot, InstallTotals, SlotSnapshot, SlotState } from '../contracts/StatusStreamTypes.js';

/**
 * Stable, indexed slot table. One row per concurrent installer worker.
 *
 * The slot at a given index is reused across actions — this is what lets the
 * CLI render a fixed-height region in Ink without row reflow.
 */
export class SlotTable {
  private readonly slots: MutableSlot[];
  private totals: InstallTotals = { added: 0, updated: 0, removed: 0, unchanged: 0, bytesDone: 0, bytesTotal: 0 };

  constructor(slotCount: number) {
    const n = Math.max(1, slotCount);
    this.slots = Array.from({ length: n }, (_, slotId) => ({ slotId, state: 'idle', bytesDone: 0, attempt: 0 }));
  }

  /** Claim the first idle slot and populate its initial state. */
  claim(patch: Omit<MutableSlot, 'slotId'>): number | null {
    for (const s of this.slots) {
      if (s.state === 'idle' || s.state === 'done' || s.state === 'failed') {
        Object.assign(s, { ...patch });
        return s.slotId;
      }
    }
    return null;
  }

  /** Update a specific slot. */
  update(slotId: number, patch: Partial<Omit<MutableSlot, 'slotId'>>): void {
    const s = this.slots[slotId];
    if (!s) return;
    Object.assign(s, patch);
  }

  /** Reset a slot to idle after its work is done. */
  release(slotId: number): void {
    const s = this.slots[slotId];
    if (!s) return;
    s.state = 'idle';
    s.packageName = undefined;
    s.version = undefined;
    s.bytesDone = 0;
    s.bytesTotal = undefined;
    s.attempt = 0;
  }

  /** Set the aggregate totals. */
  setTotals(totals: InstallTotals): void {
    this.totals = totals;
  }

  /** Add bytes to the global counter. */
  addBytesDone(delta: number): void {
    this.totals = { ...this.totals, bytesDone: this.totals.bytesDone + delta };
  }

  /** Take an immutable snapshot of the current state. */
  snapshot(): DownloadStatusSnapshot {
    return {
      slots: this.slots.map((s) => ({ ...s })) as readonly SlotSnapshot[],
      totals: this.totals,
    };
  }
}

interface MutableSlot {
  slotId: number;
  state: SlotState;
  packageName?: SlotSnapshot['packageName'];
  version?: SlotSnapshot['version'];
  bytesDone: number;
  bytesTotal?: number;
  attempt: number;
}
