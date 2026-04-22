import type { Diagnostic } from '@uapkg/diagnostics';
import { describe, expect, it } from 'vitest';
import { DIAGNOSTIC_LEVEL_ORDER, sortDiagnostics } from '../../src/reporting/TextSink.js';

function d(level: Diagnostic['level'], code = 'X'): Diagnostic {
  return { level, code, message: `${level}-${code}` } as Diagnostic;
}

describe('TextSink', () => {
  it('level order: error < warning < info', () => {
    expect(DIAGNOSTIC_LEVEL_ORDER.error).toBeLessThan(DIAGNOSTIC_LEVEL_ORDER.warning);
    expect(DIAGNOSTIC_LEVEL_ORDER.warning).toBeLessThan(DIAGNOSTIC_LEVEL_ORDER.info);
  });

  it('sortDiagnostics orders by level', () => {
    const input = [d('info', 'A'), d('error', 'B'), d('warning', 'C'), d('error', 'D')];
    const sorted = sortDiagnostics(input);
    expect(sorted.map((x) => x.level)).toEqual(['error', 'error', 'warning', 'info']);
  });

  it('sortDiagnostics does not mutate input', () => {
    const input = [d('info'), d('error')];
    const copy = [...input];
    sortDiagnostics(input);
    expect(input).toEqual(copy);
  });
});
