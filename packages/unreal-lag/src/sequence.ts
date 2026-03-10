export interface SequenceId {
  epoch: bigint;
  value: number;
}

export class SequenceCounter {
  private epoch = 0n;
  private value = 0;

  constructor(private readonly maxValue: number = Number.MAX_SAFE_INTEGER) {}

  next(): SequenceId {
    const current: SequenceId = { epoch: this.epoch, value: this.value };
    if (this.value >= this.maxValue) {
      this.value = 0;
      this.epoch += 1n;
    } else {
      this.value += 1;
    }
    return current;
  }
}

export function compareSequence(a: SequenceId, b: SequenceId): number {
  if (a.epoch < b.epoch) return -1;
  if (a.epoch > b.epoch) return 1;
  return a.value - b.value;
}
