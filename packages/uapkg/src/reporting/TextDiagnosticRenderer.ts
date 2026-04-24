import type { Diagnostic } from '@uapkg/diagnostics';
import type { DiagnosticRenderer } from './DiagnosticRenderer.js';
import type { TextSink } from './TextSink.js';

/**
 * Plain-text diagnostic renderer — used by tests and by any non-TTY path
 * that prefers a deterministic string output over Ink. Stable format:
 *
 *   [<icon>] <message>
 *     → <hint>
 *
 * Icons mirror the legacy reporter so existing log-parsers still match:
 * `x` (error), `!` (warning), `i` (info).
 */
export class TextDiagnosticRenderer implements DiagnosticRenderer {
  public constructor(
    private readonly stdout: TextSink,
    private readonly stderr: TextSink,
  ) {}

  public render(diagnostics: readonly Diagnostic[], stream: 'stdout' | 'stderr'): void {
    if (diagnostics.length === 0) return;
    const sink = stream === 'stderr' ? this.stderr : this.stdout;
    for (const d of diagnostics) {
      const icon = d.level === 'error' ? 'x' : d.level === 'warning' ? '!' : 'i';
      sink.writeLine(`[${icon}] ${d.message}`);
      if (d.hint) sink.writeLine(`  → ${d.hint}`);
    }
  }
}
