import type { Diagnostic, UpluginMissingDiagnostic } from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatUpluginMissing(diagnostic: Diagnostic): string {
  const data = (diagnostic as UpluginMissingDiagnostic).data;
  const lines = [`[ERROR UPLUGIN_MISSING]: ${diagnostic.message}`, `  Plugin root: ${data.pluginRoot}`];
  if (diagnostic.hint) {
    lines.push(`  → ${diagnostic.hint}`);
  }
  return lines.join('\n');
}

export const packFormatters: FormatterMap = {
  UPLUGIN_MISSING: formatUpluginMissing,
};
