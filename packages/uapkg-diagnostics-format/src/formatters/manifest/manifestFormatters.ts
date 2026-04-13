import type { Diagnostic, ForbiddenOverridesDiagnostic, ManifestInvalidDiagnostic } from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatManifestInvalid(d: Diagnostic): string {
  const data = (d as ManifestInvalidDiagnostic).data;
  const lines = [`[ERROR MANIFEST_INVALID]: ${d.message}`, `  File: ${data.filePath}`];
  for (const issue of data.issues) {
    lines.push(`    - ${issue}`);
  }
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatForbiddenOverrides(d: Diagnostic): string {
  const data = (d as ForbiddenOverridesDiagnostic).data;
  const lines = [
    `[ERROR FORBIDDEN_OVERRIDES]: ${d.message}`,
    `  Kind: ${data.manifestKind}`,
    `  File: ${data.filePath}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

export const manifestFormatters: FormatterMap = {
  MANIFEST_INVALID: formatManifestInvalid,
  FORBIDDEN_OVERRIDES: formatForbiddenOverrides,
};
