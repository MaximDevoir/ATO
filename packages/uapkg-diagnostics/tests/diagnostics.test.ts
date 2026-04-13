import { describe, expect, it } from 'vitest';
import {
  createIoErrorDiagnostic,
  createParseErrorDiagnostic,
  createUnknownErrorDiagnostic,
  DiagnosticBag,
  fail,
  fromDiagnostics,
  ok,
} from '../src/index';

describe('Result', () => {
  it('ok wraps a value', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('fail wraps diagnostics', () => {
    const diag = createParseErrorDiagnostic('bad json');
    const result = fail([diag]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe('PARSE_ERROR');
    }
  });

  it('fromDiagnostics returns ok when no errors', () => {
    const result = fromDiagnostics([], 'hello');
    expect(result.ok).toBe(true);
  });

  it('fromDiagnostics returns fail when errors present', () => {
    const diag = createIoErrorDiagnostic('/tmp/x', 'ENOENT');
    const result = fromDiagnostics([diag], 'hello');
    expect(result.ok).toBe(false);
  });
});

describe('DiagnosticBag', () => {
  it('collects diagnostics and reports errors', () => {
    const bag = new DiagnosticBag();
    expect(bag.hasErrors()).toBe(false);

    bag.add(createParseErrorDiagnostic('bad'));
    expect(bag.hasErrors()).toBe(true);
    expect(bag.all()).toHaveLength(1);
  });

  it('toFailure returns ResultFail', () => {
    const bag = new DiagnosticBag();
    bag.add(createUnknownErrorDiagnostic('oops'));
    const result = bag.toFailure();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].code).toBe('UNKNOWN_ERROR');
    }
  });

  it('mergeArray adds external diagnostics', () => {
    const bag = new DiagnosticBag();
    const diags = [createParseErrorDiagnostic('a'), createIoErrorDiagnostic('/x', 'b')];
    bag.mergeArray(diags);
    expect(bag.all()).toHaveLength(2);
  });
});
