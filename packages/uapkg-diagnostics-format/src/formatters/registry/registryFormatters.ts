import type {
  Diagnostic,
  GitErrorDiagnostic,
  RegistryUnreachableDiagnostic,
  SchemaInvalidDiagnostic,
} from '@uapkg/diagnostics';
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

function formatRegistryUnreachable(d: Diagnostic): string {
  const data = (d as RegistryUnreachableDiagnostic).data;
  const level = d.level.toUpperCase();
  const lines = [
    `[${level} REGISTRY_UNREACHABLE]: ${d.message}`,
    `  Registry : ${data.registryName}`,
    `  URL      : ${data.url}`,
  ];
  if (data.httpStatus !== undefined) {
    lines.push(`  HTTP     : ${data.httpStatus}`);
  }
  lines.push(`  Cause    : ${data.cause}`);
  lines.push(`  Cache    : ${data.initialized ? 'initialized' : 'not initialized'}`);
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

export const registryFormatters: FormatterMap = {
  GIT_ERROR: formatGitError,
  SCHEMA_INVALID: formatSchemaInvalid,
  REGISTRY_UNREACHABLE: formatRegistryUnreachable,
};
