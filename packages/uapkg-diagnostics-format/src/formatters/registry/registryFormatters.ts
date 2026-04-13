import type { Diagnostic, GitErrorDiagnostic, SchemaInvalidDiagnostic } from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatGitError(d: Diagnostic): string {
  const data = (d as GitErrorDiagnostic).data;
  const lines = [`[ERROR GIT_ERROR]: ${d.message}`, `  Command : ${data.command}`, `  Exit    : ${data.exitCode}`];
  if (data.stderr) lines.push(`  Stderr  : ${data.stderr}`);
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatSchemaInvalid(d: Diagnostic): string {
  const data = (d as SchemaInvalidDiagnostic).data;
  const lines = [`[ERROR SCHEMA_INVALID]: ${d.message}`, `  File: ${data.filePath}`];
  for (const issue of data.issues) {
    lines.push(`    - ${issue}`);
  }
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

export const registryFormatters: FormatterMap = {
  GIT_ERROR: formatGitError,
  SCHEMA_INVALID: formatSchemaInvalid,
};
