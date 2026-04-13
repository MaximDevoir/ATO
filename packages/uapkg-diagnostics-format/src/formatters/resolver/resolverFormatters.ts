import type { CircularDepDiagnostic, Diagnostic, VersionConflictDiagnostic } from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatVersionConflict(d: Diagnostic): string {
  const data = (d as VersionConflictDiagnostic).data;
  const lines = [
    `[ERROR VERSION_CONFLICT]: ${d.message}`,
    `  Package : ${data.packageName}`,
    `  Registry: ${data.registry}`,
    `  Versions: ${data.versions.join(', ')}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatCircularDep(d: Diagnostic): string {
  const data = (d as CircularDepDiagnostic).data;
  const lines = [`[ERROR CIRCULAR_DEP]: ${d.message}`, `  Cycle: ${data.path.join(' → ')}`];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

export const resolverFormatters: FormatterMap = {
  VERSION_CONFLICT: formatVersionConflict,
  CIRCULAR_DEP: formatCircularDep,
};
