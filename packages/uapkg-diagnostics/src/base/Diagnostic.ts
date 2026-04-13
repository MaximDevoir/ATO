import type { DiagnosticLevel } from './DiagnosticLevel.js';

/**
 * Base shape for all diagnostics. Every concrete diagnostic must extend this
 * interface, discriminating on `code` so that `data` is always strongly typed.
 *
 * @typeParam C - The string literal diagnostic code.
 * @typeParam D - The shape of the typed data payload (defaults to `undefined`).
 */
export interface DiagnosticBase<C extends string = string, D = undefined> {
  /** Severity of this diagnostic. */
  readonly level: DiagnosticLevel;

  /** Stable, machine-readable code used for discrimination. */
  readonly code: C;

  /** Human-readable summary. */
  readonly message: string;

  /** Actionable hint shown to the user. */
  readonly hint?: string;

  /** Strongly typed payload whose shape is determined by `code`. */
  readonly data: D;
}

// ---------------------------------------------------------------------------
// Convenience helpers to construct a diagnostic without specifying every field
// ---------------------------------------------------------------------------

/** Create an error-level diagnostic. */
export function createDiagnostic<C extends string, D = undefined>(
  code: C,
  level: DiagnosticLevel,
  message: string,
  data: D,
  hint?: string,
): DiagnosticBase<C, D> {
  return { level, code, message, data, hint };
}
