import type { Diagnostic, DiagnosticCode } from '@uapkg/diagnostics';
import type { DiagnosticFormatterFn, FormatterMap, IFormatterRegistry } from '../contracts/FormatterTypes.js';
import { formatPlainText } from '../formatters/PlainTextFormatter.js';

/**
 * Registry that maps diagnostic codes to formatter functions.
 * Falls back to a plain-text default when no specific formatter is registered.
 */
export class FormatterRegistry implements IFormatterRegistry {
  private readonly formatters = new Map<DiagnosticCode, DiagnosticFormatterFn>();
  private readonly fallback: DiagnosticFormatterFn;

  constructor(fallback: DiagnosticFormatterFn = formatPlainText) {
    this.fallback = fallback;
  }

  /** Register a formatter for a single diagnostic code. */
  register(code: DiagnosticCode, formatter: DiagnosticFormatterFn): void {
    this.formatters.set(code, formatter);
  }

  /** Bulk-register multiple formatters from a partial map. */
  registerAll(map: FormatterMap): void {
    for (const [code, fn] of Object.entries(map)) {
      if (fn) {
        this.formatters.set(code as DiagnosticCode, fn);
      }
    }
  }

  /** Format a single diagnostic using the registered (or fallback) formatter. */
  format(diagnostic: Diagnostic): string {
    const fn = this.formatters.get(diagnostic.code) ?? this.fallback;
    return fn(diagnostic);
  }

  /** Format an array of diagnostics, joining with newlines. */
  formatAll(diagnostics: readonly Diagnostic[]): string {
    return diagnostics.map((d) => this.format(d)).join('\n');
  }
}

/**
 * Create a new `FormatterRegistry` optionally pre-loaded with formatters.
 */
export function createFormatterRegistry(initial?: FormatterMap, fallback?: DiagnosticFormatterFn): FormatterRegistry {
  const registry = new FormatterRegistry(fallback);
  if (initial) {
    registry.registerAll(initial);
  }
  return registry;
}
