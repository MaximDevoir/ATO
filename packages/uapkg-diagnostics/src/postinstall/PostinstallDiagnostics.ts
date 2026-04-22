import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Postinstall diagnostic codes
// ---------------------------------------------------------------------------

/** Postinstall was denied by policy (install.postInstallPolicy or per-registry override). */
export type PostinstallPolicyDeniedDiagnostic = DiagnosticBase<
  'POSTINSTALL_POLICY_DENIED',
  {
    readonly packageName: string;
    readonly registry: string;
    readonly policy: 'allow' | 'deny';
    readonly resolvedFrom: 'registry' | 'install';
  }
>;

/** Loading the postinstall module failed (e.g. import error). */
export type PostinstallLoadFailedDiagnostic = DiagnosticBase<
  'POSTINSTALL_LOAD_FAILED',
  {
    readonly packageName: string;
    readonly entryFile: string;
    readonly reason: string;
  }
>;

/** The postinstall module's default export failed Zod validation. */
export type PostinstallInvalidExportDiagnostic = DiagnosticBase<
  'POSTINSTALL_INVALID_EXPORT',
  {
    readonly packageName: string;
    readonly entryFile: string;
    readonly issues: readonly string[];
  }
>;

/** More than one candidate postinstall entry file exists (e.g. both .ts and .js). */
export type PostinstallDuplicateEntryDiagnostic = DiagnosticBase<
  'POSTINSTALL_DUPLICATE_ENTRY',
  {
    readonly packageName: string;
    readonly candidates: readonly string[];
  }
>;

/** Marker-block in a generated file is corrupt or was edited manually. */
export type PostinstallMarkerCorruptDiagnostic = DiagnosticBase<
  'POSTINSTALL_MARKER_CORRUPT',
  {
    readonly packageName: string;
    readonly file: string;
    readonly reason: string;
  }
>;

/** esbuild failed to transpile a `.ts` postinstall entry file. */
export type PostinstallEsbuildErrorDiagnostic = DiagnosticBase<
  'POSTINSTALL_ESBUILD_ERROR',
  {
    readonly packageName: string;
    readonly entryFile: string;
    readonly reason: string;
  }
>;

export type PostinstallDiagnostic =
  | PostinstallPolicyDeniedDiagnostic
  | PostinstallLoadFailedDiagnostic
  | PostinstallInvalidExportDiagnostic
  | PostinstallDuplicateEntryDiagnostic
  | PostinstallMarkerCorruptDiagnostic
  | PostinstallEsbuildErrorDiagnostic;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createPostinstallPolicyDeniedDiagnostic(
  packageName: string,
  registry: string,
  policy: 'allow' | 'deny',
  resolvedFrom: 'registry' | 'install',
): PostinstallPolicyDeniedDiagnostic {
  return {
    level: 'info',
    code: 'POSTINSTALL_POLICY_DENIED',
    message: `Postinstall skipped for "${packageName}" (policy=${policy}, from ${resolvedFrom}).`,
    hint:
      resolvedFrom === 'registry'
        ? `Override per-registry via \`registries.${registry}.postInstallPolicy = "allow"\`.`
        : 'Override globally via `install.postInstallPolicy = "allow"` in your uapkg config.',
    data: { packageName, registry, policy, resolvedFrom },
  };
}

export function createPostinstallLoadFailedDiagnostic(
  packageName: string,
  entryFile: string,
  reason: string,
): PostinstallLoadFailedDiagnostic {
  return {
    level: 'error',
    code: 'POSTINSTALL_LOAD_FAILED',
    message: `Failed to load postinstall for "${packageName}" from "${entryFile}": ${reason}.`,
    data: { packageName, entryFile, reason },
  };
}

export function createPostinstallInvalidExportDiagnostic(
  packageName: string,
  entryFile: string,
  issues: readonly string[],
): PostinstallInvalidExportDiagnostic {
  return {
    level: 'error',
    code: 'POSTINSTALL_INVALID_EXPORT',
    message: `Postinstall default export for "${packageName}" is invalid.`,
    hint: 'Use `definePostinstall({...})` and export the result as default.',
    data: { packageName, entryFile, issues },
  };
}

export function createPostinstallDuplicateEntryDiagnostic(
  packageName: string,
  candidates: readonly string[],
): PostinstallDuplicateEntryDiagnostic {
  return {
    level: 'error',
    code: 'POSTINSTALL_DUPLICATE_ENTRY',
    message: `Multiple postinstall entry files found for "${packageName}".`,
    hint: 'Keep only one of `.uapkg/postinstall.ts|.js|.mjs`.',
    data: { packageName, candidates },
  };
}

export function createPostinstallMarkerCorruptDiagnostic(
  packageName: string,
  file: string,
  reason: string,
): PostinstallMarkerCorruptDiagnostic {
  return {
    level: 'error',
    code: 'POSTINSTALL_MARKER_CORRUPT',
    message: `Postinstall marker block corrupt in "${file}" for "${packageName}": ${reason}.`,
    hint: 'Restore the UAPKG-BEGIN/END markers or remove them manually and re-run.',
    data: { packageName, file, reason },
  };
}

export function createPostinstallEsbuildErrorDiagnostic(
  packageName: string,
  entryFile: string,
  reason: string,
): PostinstallEsbuildErrorDiagnostic {
  return {
    level: 'error',
    code: 'POSTINSTALL_ESBUILD_ERROR',
    message: `esbuild failed on "${entryFile}" for "${packageName}": ${reason}.`,
    hint: 'Note: uapkg transpiles but does not type-check; fix the file in your IDE.',
    data: { packageName, entryFile, reason },
  };
}

