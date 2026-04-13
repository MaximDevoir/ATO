import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Resolver diagnostic codes
// ---------------------------------------------------------------------------

/** Two or more registries resolve the same package name to different versions (single-version kind). */
export type VersionConflictDiagnostic = DiagnosticBase<
  'VERSION_CONFLICT',
  {
    readonly packageName: string;
    readonly versions: readonly string[];
    readonly registry: string;
  }
>;

/** A dependency cycle was detected. */
export type CircularDepDiagnostic = DiagnosticBase<
  'CIRCULAR_DEP',
  {
    readonly path: readonly string[];
  }
>;

/** Requested package could not be found in any configured registry. */
export type PackageNotFoundDiagnostic = DiagnosticBase<
  'PACKAGE_NOT_FOUND',
  {
    readonly packageName: string;
    readonly registry: string;
  }
>;

/** No published version satisfies the requested range. */
export type VersionNotFoundDiagnostic = DiagnosticBase<
  'VERSION_NOT_FOUND',
  {
    readonly packageName: string;
    readonly versionRange: string;
    readonly registry: string;
    readonly availableVersions: readonly string[];
  }
>;

/** Same package name required from two different registries. */
export type RegistryNameCollisionDiagnostic = DiagnosticBase<
  'REGISTRY_NAME_COLLISION',
  {
    readonly packageName: string;
    readonly registries: readonly string[];
  }
>;

/** Union of all resolver diagnostics. */
export type ResolverDiagnostic =
  | VersionConflictDiagnostic
  | CircularDepDiagnostic
  | PackageNotFoundDiagnostic
  | VersionNotFoundDiagnostic
  | RegistryNameCollisionDiagnostic;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createVersionConflictDiagnostic(
  packageName: string,
  versions: readonly string[],
  registry: string,
): VersionConflictDiagnostic {
  return {
    level: 'error',
    code: 'VERSION_CONFLICT',
    message: `Version conflict for "${packageName}" in registry "${registry}": resolved to [${versions.join(', ')}].`,
    hint: 'Single-version packages cannot coexist at multiple versions. Pin an explicit version or use overrides.',
    data: { packageName, versions, registry },
  };
}

export function createCircularDepDiagnostic(path: readonly string[]): CircularDepDiagnostic {
  return {
    level: 'error',
    code: 'CIRCULAR_DEP',
    message: `Circular dependency detected: ${path.join(' → ')}.`,
    hint: 'Break the cycle by removing or restructuring the dependency.',
    data: { path },
  };
}

export function createPackageNotFoundDiagnostic(packageName: string, registry: string): PackageNotFoundDiagnostic {
  return {
    level: 'error',
    code: 'PACKAGE_NOT_FOUND',
    message: `Package "${packageName}" not found in registry "${registry}".`,
    hint: 'Verify the package name and ensure the registry is up-to-date.',
    data: { packageName, registry },
  };
}

export function createVersionNotFoundDiagnostic(
  packageName: string,
  versionRange: string,
  registry: string,
  availableVersions: readonly string[],
): VersionNotFoundDiagnostic {
  return {
    level: 'error',
    code: 'VERSION_NOT_FOUND',
    message: `No version of "${packageName}" in registry "${registry}" satisfies "${versionRange}".`,
    hint: `Available versions: ${availableVersions.length > 0 ? availableVersions.join(', ') : '(none)'}.`,
    data: { packageName, versionRange, registry, availableVersions },
  };
}

export function createRegistryNameCollisionDiagnostic(
  packageName: string,
  registries: readonly string[],
): RegistryNameCollisionDiagnostic {
  return {
    level: 'error',
    code: 'REGISTRY_NAME_COLLISION',
    message: `Package "${packageName}" is required from multiple registries: [${registries.join(', ')}].`,
    hint: 'A package name must resolve from a single registry.',
    data: { packageName, registries },
  };
}
