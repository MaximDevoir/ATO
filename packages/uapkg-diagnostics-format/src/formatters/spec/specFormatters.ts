import type {
  Diagnostic,
  InvalidOrgNameDiagnostic,
  InvalidPackageSpecDiagnostic,
  InvalidVersionRangeDiagnostic,
} from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatInvalidPackageSpec(d: Diagnostic): string {
  const data = (d as InvalidPackageSpecDiagnostic).data;
  const lines = [
    `[ERROR INVALID_PACKAGE_SPEC]: ${d.message}`,
    `  Input : ${data.input}`,
    `  Reason: ${data.reason}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatInvalidOrgName(d: Diagnostic): string {
  const data = (d as InvalidOrgNameDiagnostic).data;
  const lines = [`[ERROR INVALID_ORG_NAME]: ${d.message}`, `  Input: ${data.input}`, `  Org  : ${data.org}`];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatInvalidVersionRange(d: Diagnostic): string {
  const data = (d as InvalidVersionRangeDiagnostic).data;
  const lines = [`[ERROR INVALID_VERSION_RANGE]: ${d.message}`, `  Input: ${data.input}`, `  Range: ${data.range}`];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

export const specFormatters: FormatterMap = {
  INVALID_PACKAGE_SPEC: formatInvalidPackageSpec,
  INVALID_ORG_NAME: formatInvalidOrgName,
  INVALID_VERSION_RANGE: formatInvalidVersionRange,
};

