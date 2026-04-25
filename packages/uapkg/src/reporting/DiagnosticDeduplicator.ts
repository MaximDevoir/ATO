import { stableStringify } from '@uapkg/common';
import type { Diagnostic } from '@uapkg/diagnostics';

/**
 * Suppresses diagnostics marked as `emitPolicy: "once"` across the current
 * CLI process lifetime.
 */
export class DiagnosticDeduplicator {
  private static readonly seen = new Set<string>();

  public filter(diagnostics: readonly Diagnostic[]): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const diagnostic of diagnostics) {
      if (diagnostic.emitPolicy !== 'once') {
        out.push(diagnostic);
        continue;
      }

      const fingerprint = this.fingerprintOf(diagnostic);
      if (DiagnosticDeduplicator.seen.has(fingerprint)) {
        continue;
      }

      DiagnosticDeduplicator.seen.add(fingerprint);
      out.push(diagnostic);
    }
    return out;
  }

  private fingerprintOf(diagnostic: Diagnostic): string {
    if (diagnostic.emitFingerprint && diagnostic.emitFingerprint.trim().length > 0) {
      return diagnostic.emitFingerprint;
    }

    return stableStringify({
      level: diagnostic.level,
      code: diagnostic.code,
      message: diagnostic.message,
      hint: diagnostic.hint ?? null,
      data: diagnostic.data ?? null,
    });
  }
}
