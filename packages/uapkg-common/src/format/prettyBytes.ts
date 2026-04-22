/**
 * Human-friendly byte formatting matching the uapkg CLI convention.
 *
 * - Less than 100 MB → render as MB with 1 decimal place (e.g. `85.3 MB`).
 * - 100 MB or greater → render as GB with 1 decimal place (e.g. `2.0 GB`).
 * - Negative or non-finite values are clamped to 0.
 *
 * Uses SI units (1 MB = 1_000_000 bytes). This is deliberate: user-facing
 * package sizes are reported by registries in decimal units.
 */
export function prettyBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const MB = 1_000_000;
  const GB = 1_000_000_000;
  const THRESHOLD = 100 * MB;
  if (value < THRESHOLD) {
    return `${(value / MB).toFixed(1)} MB`;
  }
  return `${(value / GB).toFixed(1)} GB`;
}

/**
 * Render a progress pair like `"12.3 MB/85.0 MB"`. Both numbers use the same
 * unit chosen by the larger of the two, so the ratio stays readable.
 */
export function prettyBytesProgress(done: number, total: number): string {
  const safeDone = Number.isFinite(done) && done > 0 ? done : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const MB = 1_000_000;
  const GB = 1_000_000_000;
  const THRESHOLD = 100 * MB;
  if (safeTotal < THRESHOLD) {
    return `${(safeDone / MB).toFixed(1)} MB/${(safeTotal / MB).toFixed(1)} MB`;
  }
  return `${(safeDone / GB).toFixed(1)} GB/${(safeTotal / GB).toFixed(1)} GB`;
}
