import { prettyBytes } from '@uapkg/common';
import type { DownloadStatusSnapshot } from '@uapkg/installer';
import { ProcessTextSink, type TextSink } from './TextSink.js';

/**
 * Text-mode progress reporter for `uapkg install / add / update`.
 *
 * Subscribes to the installer's `AsyncIterable<DownloadStatusSnapshot>` and
 * writes a one-line summary whenever the *aggregate totals* change. This keeps
 * output readable even when stdout is piped or captured (no ANSI cursor
 * tricks). Per-slot rows are intentionally omitted in the MVP — the full Ink
 * `InstallProgress` grid is a planned follow-up.
 *
 * At completion, emits a final summary line:
 *   `N added, M updated, X removed, Y unchanged  (B bytes)`
 */
export class InstallProgressReporter {
  private lastBytesDone = -1;
  private lastState = '';

  public constructor(private readonly sink: TextSink = new ProcessTextSink(process.stdout)) {}

  public async consume(stream: AsyncIterable<DownloadStatusSnapshot>): Promise<void> {
    for await (const snapshot of stream) {
      this.renderTick(snapshot);
    }
  }

  private renderTick(snapshot: DownloadStatusSnapshot): void {
    const { totals, slots } = snapshot;
    const active = slots.filter(
      (s) => s.state === 'downloading' || s.state === 'verifying' || s.state === 'extracting' || s.state === 'removing',
    ).length;

    const stateKey = `${active}|${totals.bytesDone}|${totals.bytesTotal}`;
    if (stateKey === this.lastState) return;
    this.lastState = stateKey;

    // Only emit a byte-progress line when bytesTotal is known and has advanced.
    if (totals.bytesTotal > 0 && totals.bytesDone !== this.lastBytesDone) {
      this.lastBytesDone = totals.bytesDone;
      const pct = Math.min(100, Math.floor((totals.bytesDone / totals.bytesTotal) * 100));
      this.sink.writeLine(
        `  installing: ${pct}% (${prettyBytes(totals.bytesDone)} / ${prettyBytes(totals.bytesTotal)}) — ${active} active`,
      );
    }
  }

  /**
   * Emit the post-install one-liner. The caller passes the installer's plan
   * summary directly; this class does not retain it.
   */
  public renderSummary(summary: {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
    totalBytes: number;
  }): void {
    this.sink.writeLine(
      `${summary.added} added, ${summary.updated} updated, ${summary.removed} removed, ${summary.unchanged} unchanged (${prettyBytes(summary.totalBytes)})`,
    );
  }
}

