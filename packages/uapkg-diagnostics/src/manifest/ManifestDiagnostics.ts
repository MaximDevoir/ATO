import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Manifest diagnostic codes
// ---------------------------------------------------------------------------

/** Manifest content failed schema validation. */
export type ManifestInvalidDiagnostic = DiagnosticBase<
  'MANIFEST_INVALID',
  {
    readonly filePath: string;
    readonly issues: readonly string[];
  }
>;

/** Lockfile content failed schema validation. */
export type LockfileInvalidDiagnostic = DiagnosticBase<
  'LOCKFILE_INVALID',
  {
    readonly filePath: string;
    readonly issues: readonly string[];
  }
>;

/** Overrides are only allowed in root project manifests. */
export type ForbiddenOverridesDiagnostic = DiagnosticBase<
  'FORBIDDEN_OVERRIDES',
  {
    readonly manifestKind: string;
    readonly filePath: string;
  }
>;

/** A registry name referenced in a dependency is not in configuration. */
export type UnresolvedRegistryDiagnostic = DiagnosticBase<
  'UNRESOLVED_REGISTRY',
  {
    readonly registryName: string;
    readonly dependencyName: string;
  }
>;

/** Failed to read a manifest or lockfile from disk. */
export type ManifestReadErrorDiagnostic = DiagnosticBase<
  'MANIFEST_READ_ERROR',
  {
    readonly filePath: string;
    readonly reason: string;
  }
>;

/** Failed to write a manifest or lockfile to disk. */
export type ManifestWriteErrorDiagnostic = DiagnosticBase<
  'MANIFEST_WRITE_ERROR',
  {
    readonly filePath: string;
    readonly reason: string;
  }
>;

/** Union of all manifest diagnostics. */
export type ManifestDiagnostic =
  | ManifestInvalidDiagnostic
  | LockfileInvalidDiagnostic
  | ForbiddenOverridesDiagnostic
  | UnresolvedRegistryDiagnostic
  | ManifestReadErrorDiagnostic
  | ManifestWriteErrorDiagnostic;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createManifestInvalidDiagnostic(
  filePath: string,
  issues: readonly string[],
): ManifestInvalidDiagnostic {
  return {
    level: 'error',
    code: 'MANIFEST_INVALID',
    message: `Manifest validation failed for "${filePath}".`,
    hint: 'Review your uapkg.json against the expected schema.',
    data: { filePath, issues },
  };
}

export function createLockfileInvalidDiagnostic(
  filePath: string,
  issues: readonly string[],
): LockfileInvalidDiagnostic {
  return {
    level: 'error',
    code: 'LOCKFILE_INVALID',
    message: `Lockfile validation failed for "${filePath}".`,
    hint: 'Delete uapkg.lock and re-run install to regenerate.',
    data: { filePath, issues },
  };
}

export function createForbiddenOverridesDiagnostic(
  manifestKind: string,
  filePath: string,
): ForbiddenOverridesDiagnostic {
  return {
    level: 'error',
    code: 'FORBIDDEN_OVERRIDES',
    message: `Overrides are not allowed in "${manifestKind}" manifests ("${filePath}").`,
    hint: 'Overrides may only appear in root project manifests.',
    data: { manifestKind, filePath },
  };
}

export function createUnresolvedRegistryDiagnostic(
  registryName: string,
  dependencyName: string,
): UnresolvedRegistryDiagnostic {
  return {
    level: 'error',
    code: 'UNRESOLVED_REGISTRY',
    message: `Registry "${registryName}" referenced by dependency "${dependencyName}" is not configured.`,
    hint: 'Add the registry to your uapkg configuration.',
    data: { registryName, dependencyName },
  };
}

export function createManifestReadErrorDiagnostic(filePath: string, reason: string): ManifestReadErrorDiagnostic {
  return {
    level: 'error',
    code: 'MANIFEST_READ_ERROR',
    message: `Failed to read "${filePath}": ${reason}.`,
    hint: 'Ensure the file exists and is valid JSON.',
    data: { filePath, reason },
  };
}

export function createManifestWriteErrorDiagnostic(filePath: string, reason: string): ManifestWriteErrorDiagnostic {
  return {
    level: 'error',
    code: 'MANIFEST_WRITE_ERROR',
    message: `Failed to write "${filePath}": ${reason}.`,
    hint: 'Ensure the directory exists and you have write permissions.',
    data: { filePath, reason },
  };
}
