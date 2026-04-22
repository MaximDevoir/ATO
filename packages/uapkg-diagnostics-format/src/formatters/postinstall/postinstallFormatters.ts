import type {
  Diagnostic,
  PostinstallDuplicateEntryDiagnostic,
  PostinstallEsbuildErrorDiagnostic,
  PostinstallInvalidExportDiagnostic,
  PostinstallLoadFailedDiagnostic,
  PostinstallMarkerCorruptDiagnostic,
  PostinstallPolicyDeniedDiagnostic,
} from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatPolicyDenied(d: Diagnostic): string {
  const data = (d as PostinstallPolicyDeniedDiagnostic).data;
  const lines = [
    `[INFO POSTINSTALL_POLICY_DENIED]: ${d.message}`,
    `  Registry: ${data.registry}`,
    `  Policy  : ${data.policy} (from ${data.resolvedFrom})`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatLoadFailed(d: Diagnostic): string {
  const data = (d as PostinstallLoadFailedDiagnostic).data;
  return `[ERROR POSTINSTALL_LOAD_FAILED]: ${d.message}\n  Entry: ${data.entryFile}`;
}

function formatInvalidExport(d: Diagnostic): string {
  const data = (d as PostinstallInvalidExportDiagnostic).data;
  const lines = [`[ERROR POSTINSTALL_INVALID_EXPORT]: ${d.message}`, `  Entry: ${data.entryFile}`];
  for (const issue of data.issues) lines.push(`    - ${issue}`);
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatDuplicateEntry(d: Diagnostic): string {
  const data = (d as PostinstallDuplicateEntryDiagnostic).data;
  const lines = [`[ERROR POSTINSTALL_DUPLICATE_ENTRY]: ${d.message}`];
  for (const c of data.candidates) lines.push(`    - ${c}`);
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatMarkerCorrupt(d: Diagnostic): string {
  const data = (d as PostinstallMarkerCorruptDiagnostic).data;
  return `[ERROR POSTINSTALL_MARKER_CORRUPT]: ${d.message}\n  File: ${data.file}`;
}

function formatEsbuildError(d: Diagnostic): string {
  const data = (d as PostinstallEsbuildErrorDiagnostic).data;
  return `[ERROR POSTINSTALL_ESBUILD_ERROR]: ${d.message}\n  Entry: ${data.entryFile}`;
}

export const postinstallFormatters: FormatterMap = {
  POSTINSTALL_POLICY_DENIED: formatPolicyDenied,
  POSTINSTALL_LOAD_FAILED: formatLoadFailed,
  POSTINSTALL_INVALID_EXPORT: formatInvalidExport,
  POSTINSTALL_DUPLICATE_ENTRY: formatDuplicateEntry,
  POSTINSTALL_MARKER_CORRUPT: formatMarkerCorrupt,
  POSTINSTALL_ESBUILD_ERROR: formatEsbuildError,
};
