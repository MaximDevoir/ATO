import { describe, expect, it } from 'vitest';
import { JsonReporter } from '../../src/reporting/JsonReporter.js';
import { MemoryTextSink } from '../_fakes/MemoryTextSink.js';

describe('JsonReporter', () => {
  it('emits a single JSON line per call', () => {
    const sink = new MemoryTextSink();
    const reporter = new JsonReporter(sink);
    reporter.emit({ status: 'ok', command: 'add', diagnostics: [], data: { added: 1 } });
    expect(sink.lines).toHaveLength(1);
    const parsed = JSON.parse(sink.lines[0]) as {
      status: string;
      command: string;
      data: { added: number };
      diagnostics: unknown[];
    };
    expect(parsed.status).toBe('ok');
    expect(parsed.command).toBe('add');
    expect(parsed.data.added).toBe(1);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('always includes diagnostics array', () => {
    const sink = new MemoryTextSink();
    const reporter = new JsonReporter(sink);
    reporter.emit({ status: 'error', command: 'install', diagnostics: [] });
    const parsed = JSON.parse(sink.lines[0]) as { diagnostics: unknown[] };
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
  });
});
