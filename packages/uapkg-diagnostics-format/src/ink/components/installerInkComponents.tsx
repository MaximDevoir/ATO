import type {
  DiskRemoveFailedDiagnostic,
  DownloadFailedDiagnostic,
  DownloadHttpStatusDiagnostic,
  ExtractionFailedDiagnostic,
  IntegrityMismatchDiagnostic,
  NetworkRetriesExhaustedDiagnostic,
  NetworkTimeoutDiagnostic,
} from '@uapkg/diagnostics';
import { Box, Text } from 'ink';
import React, { type ReactElement } from 'react';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function DownloadFailed({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as DownloadFailedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Downloading <Text color="cyan">{data.packageName}</Text> failed on attempt{' '}
        <Text color="yellow">{data.attempt}</Text>.
      </Text>
      <Text>
        URL: <Text color="gray">{data.url}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function DownloadHttpStatus({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as DownloadHttpStatusDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{data.packageName}</Text> returned HTTP <Text color="yellow">{data.status}</Text>.
      </Text>
      <Text>
        URL: <Text color="gray">{data.url}</Text>
      </Text>
    </Box>
  );
}

function NetworkTimeout({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as NetworkTimeoutDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Timed out after <Text color="yellow">{data.timeoutSeconds}s</Text> fetching{' '}
        <Text color="cyan">{data.packageName}</Text>.
      </Text>
      <Text>
        URL: <Text color="gray">{data.url}</Text>
      </Text>
    </Box>
  );
}

function NetworkRetriesExhausted({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as NetworkRetriesExhaustedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Gave up on <Text color="cyan">{data.packageName}</Text> after <Text color="yellow">{data.attempts}</Text>{' '}
        attempts.
      </Text>
      <Text>
        URL: <Text color="gray">{data.url}</Text>
      </Text>
    </Box>
  );
}

function IntegrityMismatch({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as IntegrityMismatchDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Integrity mismatch for <Text color="cyan">{data.packageName}</Text>.
      </Text>
      <Text>
        Expected: <Text color="gray">{data.expected}</Text>
      </Text>
      <Text>
        Actual: <Text color="yellow">{data.actual}</Text>
      </Text>
    </Box>
  );
}

function ExtractionFailed({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ExtractionFailedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Extraction of <Text color="cyan">{data.packageName}</Text> failed.
      </Text>
      <Text>
        Path: <Text color="gray">{data.path}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function DiskRemoveFailed({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as DiskRemoveFailedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Could not remove <Text color="cyan">{data.packageName}</Text> from disk.
      </Text>
      <Text>
        Path: <Text color="gray">{data.path}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

export const installerInkComponents: DiagnosticInkComponentMap = {
  DOWNLOAD_FAILED: DownloadFailed,
  DOWNLOAD_HTTP_STATUS: DownloadHttpStatus,
  NETWORK_TIMEOUT: NetworkTimeout,
  NETWORK_RETRIES_EXHAUSTED: NetworkRetriesExhausted,
  INTEGRITY_MISMATCH: IntegrityMismatch,
  EXTRACTION_FAILED: ExtractionFailed,
  DISK_REMOVE_FAILED: DiskRemoveFailed,
};
