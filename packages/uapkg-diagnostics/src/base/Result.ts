import type { Diagnostic } from '../types.js';

// ---------------------------------------------------------------------------
// Result<T> — the universal return type for fallible operations.
// ---------------------------------------------------------------------------

/** Successful result carrying a value and optional diagnostics. */
export interface ResultOk<T> {
  readonly ok: true;
  readonly value: T;
  readonly diagnostics: readonly Diagnostic[];
}

/** Failed result carrying at least one diagnostic. */
export interface ResultFail {
  readonly ok: false;
  readonly diagnostics: readonly Diagnostic[];
}

/** Discriminated union returned by every fallible uapkg operation. */
export type Result<T> = ResultOk<T> | ResultFail;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Create a successful result. */
export function ok<T>(value: T, diagnostics: readonly Diagnostic[] = []): ResultOk<T> {
  return { ok: true, value, diagnostics };
}

/** Create a failed result. */
export function fail(diagnostics: readonly Diagnostic[]): ResultFail {
  return { ok: false, diagnostics };
}

/**
 * Build a result from a diagnostics array and an optional value.
 * If any diagnostic has level `error`, the result is a failure.
 */
export function fromDiagnostics<T>(diagnostics: readonly Diagnostic[], value?: T): Result<T> {
  const hasError = diagnostics.some((d) => d.level === 'error');
  if (hasError || value === undefined) {
    return { ok: false, diagnostics };
  }
  return { ok: true, value, diagnostics };
}
