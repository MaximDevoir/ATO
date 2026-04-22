import type {
  Diagnostic,
  DiskRemoveFailedDiagnostic,
  DownloadFailedDiagnostic,
  DownloadHttpStatusDiagnostic,
  ExtractionFailedDiagnostic,
  IntegrityMismatchDiagnostic,
  NetworkRetriesExhaustedDiagnostic,
  NetworkTimeoutDiagnostic,
} from '@uapkg/diagnostics';
import type { FormatterMap } from '../../contracts/FormatterTypes.js';

function formatDownloadFailed(d: Diagnostic): string {
  const data = (d as DownloadFailedDiagnostic).data;
  const lines = [
    `[ERROR DOWNLOAD_FAILED]: ${d.message}`,
    `  Package : ${data.packageName}`,
    `  URL     : ${data.url}`,
    `  Attempt : ${data.attempt}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatDownloadHttpStatus(d: Diagnostic): string {
  const data = (d as DownloadHttpStatusDiagnostic).data;
  return `[ERROR DOWNLOAD_HTTP_STATUS]: ${d.message}\n  URL: ${data.url}\n  Status: ${data.status}`;
}

function formatNetworkTimeout(d: Diagnostic): string {
  const data = (d as NetworkTimeoutDiagnostic).data;
  const lines = [`[ERROR NETWORK_TIMEOUT]: ${d.message}`, `  URL: ${data.url}`, `  Timeout: ${data.timeoutSeconds}s`];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatNetworkRetriesExhausted(d: Diagnostic): string {
  const data = (d as NetworkRetriesExhaustedDiagnostic).data;
  const lines = [
    `[ERROR NETWORK_RETRIES_EXHAUSTED]: ${d.message}`,
    `  URL: ${data.url}`,
    `  Attempts: ${data.attempts}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatIntegrityMismatch(d: Diagnostic): string {
  const data = (d as IntegrityMismatchDiagnostic).data;
  const lines = [
    `[ERROR INTEGRITY_MISMATCH]: ${d.message}`,
    `  Expected: ${data.expected}`,
    `  Actual  : ${data.actual}`,
  ];
  if (d.hint) lines.push(`  → ${d.hint}`);
  return lines.join('\n');
}

function formatExtractionFailed(d: Diagnostic): string {
  const data = (d as ExtractionFailedDiagnostic).data;
  return `[ERROR EXTRACTION_FAILED]: ${d.message}\n  Path: ${data.path}`;
}

function formatDiskRemoveFailed(d: Diagnostic): string {
  const data = (d as DiskRemoveFailedDiagnostic).data;
  return `[ERROR DISK_REMOVE_FAILED]: ${d.message}\n  Path: ${data.path}`;
}

export const installerFormatters: FormatterMap = {
  DOWNLOAD_FAILED: formatDownloadFailed,
  DOWNLOAD_HTTP_STATUS: formatDownloadHttpStatus,
  NETWORK_TIMEOUT: formatNetworkTimeout,
  NETWORK_RETRIES_EXHAUSTED: formatNetworkRetriesExhausted,
  INTEGRITY_MISMATCH: formatIntegrityMismatch,
  EXTRACTION_FAILED: formatExtractionFailed,
  DISK_REMOVE_FAILED: formatDiskRemoveFailed,
};

