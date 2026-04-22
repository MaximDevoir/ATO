import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Safety diagnostic codes — emitted by @uapkg/installer's SafetyPolicy layer.
// ---------------------------------------------------------------------------

/**
 * A target install directory exists but has no `uapkg.json` inside.
 * The installer refuses to overwrite because the directory's identity is
 * unknown. Use `--force` to override.
 */
export type SafetyTargetExistsNoManifestDiagnostic = DiagnosticBase<
  'SAFETY_TARGET_EXISTS_NO_MANIFEST',
  {
    readonly packageName: string;
    readonly path: string;
  }
>;

/**
 * A plugin-kind manifest declared a custom install `path` for one of its
 * dependencies. Only project-kind manifests may override paths; plugins fall
 * back to the default install location and this warning is emitted.
 */
export type SafetyPathNotProjectManifestDiagnostic = DiagnosticBase<
  'SAFETY_PATH_NOT_PROJECT_MANIFEST',
  {
    readonly pluginName: string;
    readonly dependencyName: string;
    readonly requestedPath: string;
    readonly fallbackPath: string;
  }
>;

/** Informational: a safety check was bypassed because --force was passed. */
export type SafetyOverriddenByForceDiagnostic = DiagnosticBase<
  'SAFETY_OVERRIDDEN_BY_FORCE',
  {
    readonly packageName: string;
    readonly policy: string;
  }
>;

export type SafetyDiagnostic =
  | SafetyTargetExistsNoManifestDiagnostic
  | SafetyPathNotProjectManifestDiagnostic
  | SafetyOverriddenByForceDiagnostic;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createSafetyTargetExistsNoManifestDiagnostic(
  packageName: string,
  path: string,
): SafetyTargetExistsNoManifestDiagnostic {
  return {
    level: 'error',
    code: 'SAFETY_TARGET_EXISTS_NO_MANIFEST',
    message: `Refusing to overwrite "${path}" (no uapkg.json found) for package "${packageName}".`,
    hint: 'Remove the directory or re-run with --force to overwrite.',
    data: { packageName, path },
  };
}

export function createSafetyPathNotProjectManifestDiagnostic(
  pluginName: string,
  dependencyName: string,
  requestedPath: string,
  fallbackPath: string,
): SafetyPathNotProjectManifestDiagnostic {
  return {
    level: 'warning',
    code: 'SAFETY_PATH_NOT_PROJECT_MANIFEST',
    message: `Plugin "${pluginName}" requested install path "${requestedPath}" for "${dependencyName}"; using default "${fallbackPath}" instead.`,
    hint: 'Only project-kind manifests may dictate install paths. Move the override to your project manifest.',
    data: { pluginName, dependencyName, requestedPath, fallbackPath },
  };
}

export function createSafetyOverriddenByForceDiagnostic(
  packageName: string,
  policy: string,
): SafetyOverriddenByForceDiagnostic {
  return {
    level: 'info',
    code: 'SAFETY_OVERRIDDEN_BY_FORCE',
    message: `Safety policy "${policy}" bypassed for "${packageName}" (--force).`,
    data: { packageName, policy },
  };
}
