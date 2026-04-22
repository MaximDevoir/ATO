import { describe, expect, it } from 'vitest';
import type { DownloadStatusSnapshot } from '@uapkg/installer';
import { InstallProgressReporter } from '../../src/reporting/InstallProgressReporter.js';
import { MemoryTextSink } from '../_fakes/MemoryTextSink.js';

function snap(
  bytesDone: number,
  bytesTotal: number,
  activeSlots = 1,
): DownloadStatusSnapshot {
  return {
    slots: Array.from({ length: activeSlots }, (_, i) => ({
      slotId: i,
      state: 'downloading' as const,
      bytesDone: 0,
      attempt: 1,
    })),
    totals: {
      added: 0,
      updated: 0,
      removed: 0,
      unchanged: 0,
      bytesDone,
      bytesTotal,
    },
  };
}

async function* iter(...snaps: DownloadStatusSnapshot[]): AsyncIterable<DownloadStatusSnapshot> {
  for (const s of snaps) yield s;
}

describe('InstallProgressReporter', () => {
  it('emits a progress line when bytesDone advances', async () => {
    const sink = new MemoryTextSink();
    const reporter = new InstallProgressReporter(sink);
    await reporter.consume(iter(snap(10, 100), snap(50, 100), snap(100, 100)));
    expect(sink.lines.length).toBeGreaterThanOrEqual(1);
    expect(sink.lines.every((l) => l.includes('installing'))).toBe(true);
  });

  it('dedups identical ticks (no duplicate lines when state unchanged)', async () => {
    const sink = new MemoryTextSink();
    const reporter = new InstallProgressReporter(sink);
    await reporter.consume(iter(snap(10, 100), snap(10, 100), snap(10, 100)));
    expect(sink.lines.length).toBe(1);
  });

  it('emits no lines when bytesTotal is unknown (0)', async () => {
    const sink = new MemoryTextSink();
    const reporter = new InstallProgressReporter(sink);
    await reporter.consume(iter(snap(10, 0)));
    expect(sink.lines.length).toBe(0);
  });

  it('renderSummary prints plan summary', () => {
    const sink = new MemoryTextSink();
    const reporter = new InstallProgressReporter(sink);
    reporter.renderSummary({ added: 1, updated: 2, removed: 3, unchanged: 4, totalBytes: 1024 });
    expect(sink.lines).toHaveLength(1);
    expect(sink.lines[0]).toMatch(/1 added, 2 updated, 3 removed, 4 unchanged/);
  });
});

