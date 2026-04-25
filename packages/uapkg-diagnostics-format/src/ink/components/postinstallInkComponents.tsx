import type {
  PostinstallDuplicateEntryDiagnostic,
  PostinstallEsbuildErrorDiagnostic,
  PostinstallInvalidExportDiagnostic,
  PostinstallLoadFailedDiagnostic,
  PostinstallMarkerCorruptDiagnostic,
  PostinstallPolicyDeniedDiagnostic,
} from '@uapkg/diagnostics';
import { Box, Text } from 'ink';
import React, { type ReactElement } from 'react';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function PolicyDenied({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallPolicyDeniedDiagnostic).data;
  return (
    <Text>
      <Text color="cyan">{data.packageName}</Text> (registry <Text color="cyan">{data.registry}</Text>) was skipped by
      policy <Text color="yellow">{data.policy}</Text> (from <Text color="gray">{data.resolvedFrom}</Text>).
    </Text>
  );
}

function LoadFailed({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallLoadFailedDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Failed to load postinstall for <Text color="cyan">{data.packageName}</Text>.
      </Text>
      <Text>
        Entry: <Text color="cyan">{data.entryFile}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function InvalidExport({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallInvalidExportDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Export is invalid in <Text color="cyan">{data.entryFile}</Text>:
      </Text>
      {data.issues.map((issue) => (
        <Text key={issue}> • {issue}</Text>
      ))}
    </Box>
  );
}

function DuplicateEntry({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallDuplicateEntryDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{data.packageName}</Text> has multiple postinstall entry files:
      </Text>
      {data.candidates.map((c) => (
        <Text key={c}>
          {' '}
          • <Text color="yellow">{c}</Text>
        </Text>
      ))}
    </Box>
  );
}

function MarkerCorrupt({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallMarkerCorruptDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        File: <Text color="cyan">{data.file}</Text>
      </Text>
      <Text>
        Plugin: <Text color="cyan">{data.packageName}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function EsbuildError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as PostinstallEsbuildErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        esbuild failed on <Text color="cyan">{data.entryFile}</Text> for <Text color="cyan">{data.packageName}</Text>.
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

export const postinstallInkComponents: DiagnosticInkComponentMap = {
  POSTINSTALL_POLICY_DENIED: PolicyDenied,
  POSTINSTALL_LOAD_FAILED: LoadFailed,
  POSTINSTALL_INVALID_EXPORT: InvalidExport,
  POSTINSTALL_DUPLICATE_ENTRY: DuplicateEntry,
  POSTINSTALL_MARKER_CORRUPT: MarkerCorrupt,
  POSTINSTALL_ESBUILD_ERROR: EsbuildError,
};
