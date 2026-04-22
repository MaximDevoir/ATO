import type { Diagnostic } from '@uapkg/diagnostics';
import { describe, expect, it } from 'vitest';
import { DiagnosticReporter } from '../../src/reporting/DiagnosticReporter.js';
import { MemoryTextSink } from '../_fakes/MemoryTextSink.js';

function d(level: Diagnostic['level'], code = 'X', message = 'msg'): Diagnostic {
  return { level, code, message } as Diagnostic;
}

describe('DiagnosticReporter', () => {
  it('routes errors to stderr and non-errors to stdout', () => {
    const stdout = new MemoryTextSink();
    const stderr = new MemoryTextSink();
    const reporter = new DiagnosticReporter(undefined, stdout, stderr);

    reporter.reportAll([d('info', 'I'), d('error', 'E'), d('warning', 'W')]);

    expect(stderr.lines).toHaveLength(1);
    expect(stderr.lines[0]).toMatch(/^\[x\]/);
    expect(stdout.lines).toHaveLength(2);
    expect(stdout.lines.map((l) => l.charAt(1))).toEqual(['!', 'i']); // warning then info
  });

  it('reportAll is a no-op for empty input', () => {
    const stdout = new MemoryTextSink();
    const stderr = new MemoryTextSink();
    const reporter = new DiagnosticReporter(undefined, stdout, stderr);
    reporter.reportAll([]);
    expect(stdout.lines).toHaveLength(0);
    expect(stderr.lines).toHaveLength(0);
  });

  it('falls back to plain-text formatter for unknown codes', () => {
    const stdout = new MemoryTextSink();
    const stderr = new MemoryTextSink();
    const reporter = new DiagnosticReporter(undefined, stdout, stderr);
    reporter.reportOne(d('error', 'TOTALLY_UNKNOWN_CODE_ABC', 'bang'));
    expect(stderr.lines[0]).toContain('bang');
  });
});
