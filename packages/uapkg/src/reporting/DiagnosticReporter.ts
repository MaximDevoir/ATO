import type { Diagnostic } from '@uapkg/diagnostics';
import { createFormatterRegistry, defaultFormatters, type FormatterRegistry } from '@uapkg/diagnostics-format';
import { ProcessTextSink, sortDiagnostics, type TextSink } from './TextSink.js';

/**
 * Human-readable diagnostic reporter.
 *
 * Errors go to stderr; warnings + info go to stdout. Severity icons are
 * ASCII-only so the output is pipe-safe. Formatting is delegated to the
 * shared `FormatterRegistry` in `@uapkg/diagnostics-format`, which resolves
 * code-specific formatters and falls back to `formatPlainText` for anything
 * unknown.
 *
 * A single instance is safe to reuse across multiple commands in one CLI run.
 */
export class DiagnosticReporter {
  private readonly registry: FormatterRegistry;
  private readonly stdout: TextSink;
  private readonly stderr: TextSink;

  public constructor(
    registry: FormatterRegistry = createFormatterRegistry(defaultFormatters),
    stdout: TextSink = new ProcessTextSink(process.stdout),
    stderr: TextSink = new ProcessTextSink(process.stderr),
  ) {
    this.registry = registry;
    this.stdout = stdout;
    this.stderr = stderr;
  }

  public reportAll(diagnostics: readonly Diagnostic[]): void {
    if (diagnostics.length === 0) return;
    for (const d of sortDiagnostics(diagnostics)) {
      this.reportOne(d);
    }
  }

  public reportOne(diagnostic: Diagnostic): void {
    const icon = diagnostic.level === 'error' ? 'x' : diagnostic.level === 'warning' ? '!' : 'i';
    const body = this.registry.format(diagnostic);
    const line = `[${icon}] ${body}`;
    (diagnostic.level === 'error' ? this.stderr : this.stdout).writeLine(line);
  }
}

