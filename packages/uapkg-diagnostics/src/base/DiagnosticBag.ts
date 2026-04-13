import type { Diagnostic } from '../types.js';
import { createDiagnostic } from './Diagnostic.js';
import type { DiagnosticLevel } from './DiagnosticLevel.js';
import { fail, ok, type Result } from './Result.js';

/**
 * Mutable accumulator for diagnostics produced during an operation.
 *
 * Typical usage:
 * ```ts
 * const bag = new DiagnosticBag();
 * bag.addError('MY_CODE', 'Something broke', undefined, 'Try X');
 * if (bag.hasErrors()) return bag.toFailure();
 * return bag.toResult(value);
 * ```
 */
export class DiagnosticBag {
  private readonly items: Diagnostic[] = [];

  /** Number of diagnostics collected so far. */
  get length(): number {
    return this.items.length;
  }

  /** Add a pre-built diagnostic. */
  add(diagnostic: Diagnostic): this {
    this.items.push(diagnostic);
    return this;
  }

  /** Shorthand: add an error-level diagnostic. */
  addError<C extends string, D = undefined>(code: C, message: string, data: D, hint?: string): this {
    this.items.push(createDiagnostic(code, 'error', message, data, hint) as Diagnostic);
    return this;
  }

  /** Shorthand: add a warning-level diagnostic. */
  addWarning<C extends string, D = undefined>(code: C, message: string, data: D, hint?: string): this {
    this.items.push(createDiagnostic(code, 'warning', message, data, hint) as Diagnostic);
    return this;
  }

  /** Shorthand: add an info-level diagnostic. */
  addInfo<C extends string, D = undefined>(code: C, message: string, data: D, hint?: string): this {
    this.items.push(createDiagnostic(code, 'info', message, data, hint) as Diagnostic);
    return this;
  }

  /** Merge another bag's diagnostics into this one. */
  merge(other: DiagnosticBag): this {
    for (const d of other.items) {
      this.items.push(d);
    }
    return this;
  }

  /** Merge a readonly diagnostic array into this bag. */
  mergeArray(diagnostics: readonly Diagnostic[]): this {
    for (const d of diagnostics) {
      this.items.push(d);
    }
    return this;
  }

  /** True if at least one diagnostic has level `error`. */
  hasErrors(): boolean {
    return this.items.some((d) => d.level === 'error');
  }

  /** True if at least one diagnostic has the given level. */
  hasLevel(level: DiagnosticLevel): boolean {
    return this.items.some((d) => d.level === level);
  }

  /** Return all collected diagnostics as a readonly array. */
  all(): readonly Diagnostic[] {
    return this.items;
  }

  /** Build a successful `Result<T>` carrying accumulated diagnostics. */
  toResult<T>(value: T): Result<T> {
    if (this.hasErrors()) {
      return fail(this.items);
    }
    return ok(value, this.items);
  }

  /** Build a failed `Result` from the accumulated diagnostics. */
  toFailure(): Result<never> {
    return fail(this.items);
  }
}
