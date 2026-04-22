import type {
  Diagnostic,
  SafetyOverriddenByForceDiagnostic,
  SafetyPathNotProjectManifestDiagnostic,
  SafetyTargetExistsNoManifestDiagnostic,
} from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatTargetExistsNoManifest(d: Diagnostic): string {
  const data = (d as SafetyTargetExistsNoManifestDiagnostic).data;
  const lines = [
    `[ERROR SAFETY_TARGET_EXISTS_NO_MANIFEST]: ${d.message}`,
    `  Package: ${data.packageName}`,
    `  Path   : ${data.path}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatPathNotProjectManifest(d: Diagnostic): string {
  const data = (d as SafetyPathNotProjectManifestDiagnostic).data;
  const lines = [
    `[WARN  SAFETY_PATH_NOT_PROJECT_MANIFEST]: ${d.message}`,
    `  Plugin      : ${data.pluginName}`,
    `  Dependency  : ${data.dependencyName}`,
    `  Requested   : ${data.requestedPath}`,
    `  Fallback    : ${data.fallbackPath}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatOverriddenByForce(d: Diagnostic): string {
  const data = (d as SafetyOverriddenByForceDiagnostic).data;
  return `[INFO  SAFETY_OVERRIDDEN_BY_FORCE]: ${d.message}\n  Policy: ${data.policy}`;
}

export const safetyFormatters: FormatterMap = {
  SAFETY_TARGET_EXISTS_NO_MANIFEST: formatTargetExistsNoManifest,
  SAFETY_PATH_NOT_PROJECT_MANIFEST: formatPathNotProjectManifest,
  SAFETY_OVERRIDDEN_BY_FORCE: formatOverriddenByForce,
};
