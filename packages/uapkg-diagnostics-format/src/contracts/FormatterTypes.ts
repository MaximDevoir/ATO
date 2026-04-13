import type { Diagnostic, DiagnosticCode } from '@uapkg/diagnostics';

/**
 * A function that converts a single diagnostic into a human-readable string.
 */
export type DiagnosticFormatterFn = (diagnostic: Diagnostic) => string;

/**
 * A lookup of formatter functions keyed by diagnostic code.
 */
export type FormatterMap = Partial<Record<DiagnosticCode, DiagnosticFormatterFn>>;

/**
 * Contract for a formatter registry that maps diagnostic codes to formatters.
 */
export interface IFormatterRegistry {
  /** Register a formatter for a specific code. */
  register(code: DiagnosticCode, formatter: DiagnosticFormatterFn): void;

  /** Format a single diagnostic. */
  format(diagnostic: Diagnostic): string;

  /** Format an array of diagnostics, one per line. */
  formatAll(diagnostics: readonly Diagnostic[]): string;
}
