import type { Diagnostic } from '@uapkg/diagnostics';
import { describe, expect, it } from 'vitest';
import { DiagnosticReporter } from '../../src/reporting/DiagnosticReporter.js';
import { TextDiagnosticRenderer } from '../../src/reporting/TextDiagnosticRenderer.js';
import { MemoryTextSink } from '../_fakes/MemoryTextSink.js';

function d(level: Diagnostic['level'], code = 'X', message = 'msg', hint?: string): Diagnostic {
  return { level, code, message, ...(hint ? { hint } : {}) } as Diagnostic;
}

function makeReporter() {
  const stdout = new MemoryTextSink();
  const stderr = new MemoryTextSink();
  const reporter = new DiagnosticReporter(new TextDiagnosticRenderer(stdout, stderr));
  return { reporter, stdout, stderr };
}

describe('DiagnosticReporter', () => {
  it('routes errors to stderr and non-errors to stdout', () => {
    const { reporter, stdout, stderr } = makeReporter();
    reporter.reportAll([d('info', 'I'), d('error', 'E'), d('warning', 'W')]);
    expect(stderr.lines).toHaveLength(1);
    expect(stderr.lines[0]).toMatch(/^\[x]/);
    expect(stdout.lines).toHaveLength(2);
    expect(stdout.lines.map((l) => l.charAt(1))).toEqual(['!', 'i']);
  });

  it('reportAll is a no-op for empty input', () => {
    const { reporter, stdout, stderr } = makeReporter();
    reporter.reportAll([]);
    expect(stdout.lines).toHaveLength(0);
    expect(stderr.lines).toHaveLength(0);
  });

  it('emits the message even for unknown codes', () => {
    const { reporter, stderr } = makeReporter();
    reporter.reportOne(d('error', 'TOTALLY_UNKNOWN_CODE_ABC', 'bang'));
    expect(stderr.lines.some((l) => l.includes('bang'))).toBe(true);
  });

  it('renders hint on its own line when present', () => {
    const { reporter, stderr } = makeReporter();
    reporter.reportOne(d('error', 'E', 'bang', 'do the thing'));
    expect(stderr.lines).toHaveLength(2);
    expect(stderr.lines[1]).toMatch(/→ do the thing/);
  });
});
