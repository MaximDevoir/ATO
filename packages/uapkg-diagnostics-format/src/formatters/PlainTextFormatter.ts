import type { Diagnostic } from '@uapkg/diagnostics';

/**
 * Default plain-text formatter for any diagnostic.
 *
 * Format: `[LEVEL CODE]: message`
 * If a hint is present: `  → hint`
 */
export function formatPlainText(diagnostic: Diagnostic): string {
  const tag = diagnostic.level.toUpperCase();
  let line = `[${tag} ${diagnostic.code}]: ${diagnostic.message}`;
  if (diagnostic.hint) {
    line += `\n  → ${diagnostic.hint}`;
  }
  return line;
}
