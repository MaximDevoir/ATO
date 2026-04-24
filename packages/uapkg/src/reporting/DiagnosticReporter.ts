import type { Diagnostic } from '@uapkg/diagnostics';
import type { DiagnosticRenderer } from './DiagnosticRenderer.js';
import { InkDiagnosticRenderer } from './InkDiagnosticRenderer.js';
import { sortDiagnostics } from './TextSink.js';

/**
 * Human-readable diagnostic reporter.
 *
 * Routing policy: `error` → stderr, `warning` / `info` → stdout. Output
 * rendering is delegated to an injected {@link DiagnosticRenderer} so this
 * class is UI-agnostic.
 *
 * Defaults to the Ink renderer (styled, colored output); tests typically
 * inject {@link TextDiagnosticRenderer}.
 *
 * One instance is safe to reuse across commands in a single CLI run.
 */
export class DiagnosticReporter {
  public constructor(
    private readonly renderer: DiagnosticRenderer = new InkDiagnosticRenderer(),
  ) {}

  public reportAll(diagnostics: readonly Diagnostic[]): void {
    if (diagnostics.length === 0) return;
    const sorted = sortDiagnostics(diagnostics);
    const errors = sorted.filter((d) => d.level === 'error');
    const others = sorted.filter((d) => d.level !== 'error');
    if (errors.length > 0) this.renderer.render(errors, 'stderr');
    if (others.length > 0) this.renderer.render(others, 'stdout');
  }

  public reportOne(diagnostic: Diagnostic): void {
    this.reportAll([diagnostic]);
  }
}
