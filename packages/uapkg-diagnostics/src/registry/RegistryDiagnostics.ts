import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Registry diagnostic codes
// ---------------------------------------------------------------------------

/** A network-level error when communicating with a registry. */
export type NetworkErrorDiagnostic = DiagnosticBase<
  'NETWORK_ERROR',
  {
    readonly url: string;
    readonly reason: string;
  }
>;

/** A git operation failed. */
export type GitErrorDiagnostic = DiagnosticBase<
  'GIT_ERROR',
  {
    readonly command: string;
    readonly stderr: string;
    readonly exitCode: number;
  }
>;

/** A registry document did not pass schema validation. */
export type SchemaInvalidDiagnostic = DiagnosticBase<
  'SCHEMA_INVALID',
  {
    readonly filePath: string;
    readonly issues: readonly string[];
  }
>;

/** A referenced registry name is not found in configuration. */
export type RegistryNotFoundDiagnostic = DiagnosticBase<
  'REGISTRY_NOT_FOUND',
  {
    readonly registryName: string;
  }
>;

/** Failed to acquire the registry update lock. */
export type LockAcquisitionFailedDiagnostic = DiagnosticBase<
  'LOCK_ACQUISITION_FAILED',
  {
    readonly lockPath: string;
    readonly ownerPid: number;
  }
>;

/** Registry cache could not be read. */
export type CacheReadErrorDiagnostic = DiagnosticBase<
  'CACHE_READ_ERROR',
  {
    readonly cachePath: string;
    readonly reason: string;
  }
>;

/** Registry could not be reached, optionally with cached state available. */
export type RegistryUnreachableDiagnostic = DiagnosticBase<
  'REGISTRY_UNREACHABLE',
  {
    readonly registryName: string;
    readonly url: string;
    readonly httpStatus?: number;
    readonly cause: string;
    readonly initialized: boolean;
  }
>;

/** Union of all registry diagnostics. */
export type RegistryDiagnostic =
  | NetworkErrorDiagnostic
  | GitErrorDiagnostic
  | SchemaInvalidDiagnostic
  | RegistryNotFoundDiagnostic
  | LockAcquisitionFailedDiagnostic
  | CacheReadErrorDiagnostic
  | RegistryUnreachableDiagnostic;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createNetworkErrorDiagnostic(url: string, reason: string): NetworkErrorDiagnostic {
  return {
    level: 'error',
    code: 'NETWORK_ERROR',
    message: `Network error for "${url}": ${reason}.`,
    hint: 'Check your network connection and retry.',
    data: { url, reason },
  };
}

export function createGitErrorDiagnostic(command: string, stderr: string, exitCode: number): GitErrorDiagnostic {
  return {
    level: 'error',
    code: 'GIT_ERROR',
    message: `Git command failed (exit ${exitCode}): ${command}.`,
    hint: 'Ensure git is installed and the registry URL is reachable.',
    data: { command, stderr, exitCode },
  };
}

export function createSchemaInvalidDiagnostic(filePath: string, issues: readonly string[]): SchemaInvalidDiagnostic {
  return {
    level: 'error',
    code: 'SCHEMA_INVALID',
    message: `Schema validation failed for "${filePath}".`,
    hint: 'Review the file against the expected schema.',
    data: { filePath, issues },
  };
}

export function createRegistryNotFoundDiagnostic(registryName: string): RegistryNotFoundDiagnostic {
  return {
    level: 'error',
    code: 'REGISTRY_NOT_FOUND',
    message: `Registry "${registryName}" is not defined in configuration.`,
    hint: `Add the registry. Example:
  uapkg registry add ${registryName} https://registry.example.com

Or configure manually:
  uapkg config set registries.${registryName}.url https://registry.example.com
  uapkg config set registries.${registryName}.ref.type branch
  uapkg config set registries.${registryName}.ref.value main`,
    data: { registryName },
  };
}

export function createLockAcquisitionFailedDiagnostic(
  lockPath: string,
  ownerPid: number,
): LockAcquisitionFailedDiagnostic {
  return {
    level: 'error',
    code: 'LOCK_ACQUISITION_FAILED',
    message: `Could not acquire registry lock at "${lockPath}" (held by PID ${ownerPid}).`,
    hint: 'Another uapkg process may be updating this registry. Wait or remove the stale lock.',
    data: { lockPath, ownerPid },
  };
}

export function createCacheReadErrorDiagnostic(cachePath: string, reason: string): CacheReadErrorDiagnostic {
  return {
    level: 'error',
    code: 'CACHE_READ_ERROR',
    message: `Failed to read registry cache at "${cachePath}": ${reason}.`,
    hint: 'The cache may be corrupted. Try running `uapkg update` to refresh.',
    data: { cachePath, reason },
  };
}

export function createRegistryUnreachableDiagnostic(input: {
  readonly registryName: string;
  readonly url: string;
  readonly cause: string;
  readonly initialized: boolean;
  readonly httpStatus?: number;
  readonly level?: 'error' | 'warning';
}): RegistryUnreachableDiagnostic {
  return {
    level: input.level ?? (input.initialized ? 'warning' : 'error'),
    code: 'REGISTRY_UNREACHABLE',
    message: `The "${input.registryName}" registry could not be reached at ${input.url}.`,
    emitPolicy: 'once',
    hint: `Verify the registry URL with 'uapkg config get registries.${input.registryName}.url --trace'.
The registry may also be temporarily unavailable.`,
    data: {
      registryName: input.registryName,
      url: input.url,
      cause: input.cause,
      initialized: input.initialized,
      httpStatus: input.httpStatus,
    },
  };
}
