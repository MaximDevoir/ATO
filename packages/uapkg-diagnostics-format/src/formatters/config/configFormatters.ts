import type {
  ConfigInvalidJsonDiagnostic,
  ConfigInvalidValueDiagnostic,
  ConfigTypeMismatchDiagnostic,
  ConfigUnknownKeyDiagnostic,
  ConfigUnresolvedDefaultRegistryDiagnostic,
  Diagnostic,
} from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatInvalidJson(diagnostic: Diagnostic): string {
  const data = (diagnostic as ConfigInvalidJsonDiagnostic).data;
  const lines = [
    `[WARNING CONFIG_INVALID_JSON]: ${diagnostic.message}`,
    `  File: ${data.filePath}`,
    `  Reason: ${data.reason}`,
  ];
  if (diagnostic.hint) lines.push(`  → ${diagnostic.hint}`);
  return lines.join('\n');
}

function formatTypeMismatch(diagnostic: Diagnostic): string {
  const data = (diagnostic as ConfigTypeMismatchDiagnostic).data;
  const lines = [
    `[WARNING CONFIG_TYPE_MISMATCH]: ${diagnostic.message}`,
    `  Path: ${data.path}`,
    `  Expected: ${data.expectedType}`,
    `  Actual: ${data.actualType}`,
    `  Source: ${data.source}`,
  ];
  if (data.filePath) lines.push(`  File: ${data.filePath}`);
  if (diagnostic.hint) lines.push(`  → ${diagnostic.hint}`);
  return lines.join('\n');
}

function formatUnknownKey(diagnostic: Diagnostic): string {
  const data = (diagnostic as ConfigUnknownKeyDiagnostic).data;
  const lines = [
    `[WARNING CONFIG_UNKNOWN_KEY]: ${diagnostic.message}`,
    `  Path: ${data.path}`,
    `  Source: ${data.source}`,
  ];
  if (data.filePath) lines.push(`  File: ${data.filePath}`);
  if (diagnostic.hint) lines.push(`  → ${diagnostic.hint}`);
  return lines.join('\n');
}

function formatUnresolvedRegistry(diagnostic: Diagnostic): string {
  const data = (diagnostic as ConfigUnresolvedDefaultRegistryDiagnostic).data;
  const lines = [
    `[WARNING CONFIG_UNRESOLVED_DEFAULT_REGISTRY]: ${diagnostic.message}`,
    `  Registry: ${data.registryName}`,
  ];
  if (diagnostic.hint) lines.push(`  → ${diagnostic.hint}`);
  return lines.join('\n');
}

function formatInvalidValue(diagnostic: Diagnostic): string {
  const data = (diagnostic as ConfigInvalidValueDiagnostic).data;
  const lines = [
    `[WARNING CONFIG_INVALID_VALUE]: ${diagnostic.message}`,
    `  Path: ${data.path}`,
    `  Rule: ${data.rule}`,
  ];
  if (diagnostic.hint) lines.push(`  → ${diagnostic.hint}`);
  return lines.join('\n');
}

export const configFormatters: FormatterMap = {
  CONFIG_INVALID_JSON: formatInvalidJson,
  CONFIG_TYPE_MISMATCH: formatTypeMismatch,
  CONFIG_UNKNOWN_KEY: formatUnknownKey,
  CONFIG_UNRESOLVED_DEFAULT_REGISTRY: formatUnresolvedRegistry,
  CONFIG_INVALID_VALUE: formatInvalidValue,
};
