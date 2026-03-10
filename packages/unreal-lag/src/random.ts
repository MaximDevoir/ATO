export class RandomSource {
  private state?: number;
  constructor(seed?: number) {
    if (seed !== undefined) {
      this.state = seed >>> 0;
    }
  }
  next(): number {
    if (this.state === undefined) {
      return Math.random();
    }
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chancePct(percent: number): boolean {
    return this.next() * 100 < percent;
  }
  intInclusive(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }
}
