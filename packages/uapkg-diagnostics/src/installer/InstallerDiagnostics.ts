import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Installer diagnostic codes
// ---------------------------------------------------------------------------

/** HTTP download of a package .tgz asset failed. */
export type DownloadFailedDiagnostic = DiagnosticBase<
  'DOWNLOAD_FAILED',
  {
    readonly packageName: string;
    readonly url: string;
    readonly reason: string;
    readonly attempt: number;
  }
>;

/** Remote responded with a non-2xx HTTP status. */
export type DownloadHttpStatusDiagnostic = DiagnosticBase<
  'DOWNLOAD_HTTP_STATUS',
  {
    readonly packageName: string;
    readonly url: string;
    readonly status: number;
  }
>;

/** Download timed out per `network.timeout`. */
export type NetworkTimeoutDiagnostic = DiagnosticBase<
  'NETWORK_TIMEOUT',
  {
    readonly packageName: string;
    readonly url: string;
    readonly timeoutSeconds: number;
  }
>;

/** Retries exhausted per `network.retries`. */
export type NetworkRetriesExhaustedDiagnostic = DiagnosticBase<
  'NETWORK_RETRIES_EXHAUSTED',
  {
    readonly packageName: string;
    readonly url: string;
    readonly attempts: number;
  }
>;

/** Downloaded file hash did not match the expected integrity from the registry. */
export type IntegrityMismatchDiagnostic = DiagnosticBase<
  'INTEGRITY_MISMATCH',
  {
    readonly packageName: string;
    readonly expected: string;
    readonly actual: string;
  }
>;

/** Failed to extract a .tgz archive into the install path. */
export type ExtractionFailedDiagnostic = DiagnosticBase<
  'EXTRACTION_FAILED',
  {
    readonly packageName: string;
    readonly path: string;
    readonly reason: string;
  }
>;

/** Failed to remove a package directory. */
export type DiskRemoveFailedDiagnostic = DiagnosticBase<
  'DISK_REMOVE_FAILED',
  {
    readonly packageName: string;
    readonly path: string;
    readonly reason: string;
  }
>;

export type InstallerDiagnostic =
  | DownloadFailedDiagnostic
  | DownloadHttpStatusDiagnostic
  | NetworkTimeoutDiagnostic
  | NetworkRetriesExhaustedDiagnostic
  | IntegrityMismatchDiagnostic
  | ExtractionFailedDiagnostic
  | DiskRemoveFailedDiagnostic;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createDownloadFailedDiagnostic(
  packageName: string,
  url: string,
  reason: string,
  attempt: number,
): DownloadFailedDiagnostic {
  return {
    level: 'error',
    code: 'DOWNLOAD_FAILED',
    message: `Download of "${packageName}" failed (attempt ${attempt}): ${reason}.`,
    hint: 'Check your network connection and registry URL.',
    data: { packageName, url, reason, attempt },
  };
}

export function createDownloadHttpStatusDiagnostic(
  packageName: string,
  url: string,
  status: number,
): DownloadHttpStatusDiagnostic {
  return {
    level: 'error',
    code: 'DOWNLOAD_HTTP_STATUS',
    message: `Download of "${packageName}" returned HTTP ${status}.`,
    data: { packageName, url, status },
  };
}

export function createNetworkTimeoutDiagnostic(
  packageName: string,
  url: string,
  timeoutSeconds: number,
): NetworkTimeoutDiagnostic {
  return {
    level: 'error',
    code: 'NETWORK_TIMEOUT',
    message: `Download of "${packageName}" timed out after ${timeoutSeconds}s.`,
    hint: 'Increase `network.timeout` in your uapkg config.',
    data: { packageName, url, timeoutSeconds },
  };
}

export function createNetworkRetriesExhaustedDiagnostic(
  packageName: string,
  url: string,
  attempts: number,
): NetworkRetriesExhaustedDiagnostic {
  return {
    level: 'error',
    code: 'NETWORK_RETRIES_EXHAUSTED',
    message: `Giving up on "${packageName}" after ${attempts} attempts.`,
    hint: 'Increase `network.retries` or check network stability.',
    data: { packageName, url, attempts },
  };
}

export function createIntegrityMismatchDiagnostic(
  packageName: string,
  expected: string,
  actual: string,
): IntegrityMismatchDiagnostic {
  return {
    level: 'error',
    code: 'INTEGRITY_MISMATCH',
    message: `Integrity mismatch for "${packageName}".`,
    hint: 'The download may be corrupt or the registry entry has changed; re-run or report to the registry.',
    data: { packageName, expected, actual },
  };
}

export function createExtractionFailedDiagnostic(
  packageName: string,
  path: string,
  reason: string,
): ExtractionFailedDiagnostic {
  return {
    level: 'error',
    code: 'EXTRACTION_FAILED',
    message: `Extraction of "${packageName}" to "${path}" failed: ${reason}.`,
    data: { packageName, path, reason },
  };
}

export function createDiskRemoveFailedDiagnostic(
  packageName: string,
  path: string,
  reason: string,
): DiskRemoveFailedDiagnostic {
  return {
    level: 'error',
    code: 'DISK_REMOVE_FAILED',
    message: `Failed to remove "${packageName}" at "${path}": ${reason}.`,
    data: { packageName, path, reason },
  };
}

