import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type {
  CacheReadErrorDiagnostic,
  GitErrorDiagnostic,
  LockAcquisitionFailedDiagnostic,
  NetworkErrorDiagnostic,
  RegistryNotFoundDiagnostic,
  SchemaInvalidDiagnostic,
} from '@uapkg/diagnostics';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function NetworkError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as NetworkErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>URL: <Text color="gray">{data.url}</Text></Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function GitError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as GitErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Command: <Text color="gray">{data.command}</Text>
      </Text>
      <Text>
        Exit: <Text color="yellow">{data.exitCode}</Text>
      </Text>
      {data.stderr ? <Text color="gray">{data.stderr}</Text> : null}
    </Box>
  );
}

function SchemaInvalid({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as SchemaInvalidDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        File: <Text color="cyan">{data.filePath}</Text>
      </Text>
      {data.issues.map((issue) => (
        <Text key={issue}> • {issue}</Text>
      ))}
    </Box>
  );
}

function RegistryNotFound({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as RegistryNotFoundDiagnostic).data;
  return (
    <Text>
      Registry <Text color="cyan">{data.registryName}</Text> is not defined in configuration.
    </Text>
  );
}

function LockAcquisitionFailed({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as LockAcquisitionFailedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Lock path: <Text color="cyan">{data.lockPath}</Text>
      </Text>
      <Text>
        Held by PID <Text color="yellow">{data.ownerPid}</Text>
      </Text>
    </Box>
  );
}

function CacheReadError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as CacheReadErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Cache: <Text color="cyan">{data.cachePath}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

export const registryInkComponents: DiagnosticInkComponentMap = {
  NETWORK_ERROR: NetworkError,
  GIT_ERROR: GitError,
  SCHEMA_INVALID: SchemaInvalid,
  REGISTRY_NOT_FOUND: RegistryNotFound,
  LOCK_ACQUISITION_FAILED: LockAcquisitionFailed,
  CACHE_READ_ERROR: CacheReadError,
};

