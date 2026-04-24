import type { Diagnostic } from '@uapkg/diagnostics';

/**
 * Strategy for turning a batch of diagnostics at a single severity stream
 * into user-facing output. Implementations decide how (Ink, plain text) and
 * where (process stream, test sink) the output lands.
 *
 * Kept as a tiny interface so `DiagnosticReporter` stays ignorant of Ink
 * and so tests can inject a capturing fake without bringing up React.
 */
export interface DiagnosticRenderer {
  /**
   * Render a list of diagnostics targeted at the given logical stream.
   * Implementations must never throw — swallow any internal rendering
   * failure and fall back to a safe text path.
   */
  render(diagnostics: readonly Diagnostic[], stream: 'stdout' | 'stderr'): void;
}

