import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type {
  ForbiddenOverridesDiagnostic,
  LockfileInvalidDiagnostic,
  ManifestInvalidDiagnostic,
  ManifestReadErrorDiagnostic,
  ManifestWriteErrorDiagnostic,
  UnresolvedRegistryDiagnostic,
} from '@uapkg/diagnostics';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function FileIssues({
  filePath,
  issues,
}: {
  readonly filePath: string;
  readonly issues: readonly string[];
}): ReactElement {
  return (
    <Box flexDirection="column">
      <Text>
        File: <Text color="cyan">{filePath}</Text>
      </Text>
      {issues.map((issue) => (
        <Text key={issue}> • {issue}</Text>
      ))}
    </Box>
  );
}

function ManifestInvalid({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ManifestInvalidDiagnostic).data;
  return <FileIssues filePath={data.filePath} issues={data.issues} />;
}

function LockfileInvalid({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as LockfileInvalidDiagnostic).data;
  return <FileIssues filePath={data.filePath} issues={data.issues} />;
}

function ForbiddenOverrides({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ForbiddenOverridesDiagnostic).data;
  return (
    <Text>
      <Text color="cyan">{data.manifestKind}</Text> manifest at{' '}
      <Text color="cyan">{data.filePath}</Text> cannot declare overrides.
    </Text>
  );
}

function UnresolvedRegistry({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as UnresolvedRegistryDiagnostic).data;
  return (
    <Text>
      Dependency <Text color="cyan">{data.dependencyName}</Text> references registry{' '}
      <Text color="yellow">{data.registryName}</Text>, but no such registry is configured.
    </Text>
  );
}

function ManifestReadError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ManifestReadErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Could not read <Text color="cyan">{data.filePath}</Text>.
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function ManifestWriteError({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ManifestWriteErrorDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Could not write <Text color="cyan">{data.filePath}</Text>.
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

export const manifestInkComponents: DiagnosticInkComponentMap = {
  MANIFEST_INVALID: ManifestInvalid,
  LOCKFILE_INVALID: LockfileInvalid,
  FORBIDDEN_OVERRIDES: ForbiddenOverrides,
  UNRESOLVED_REGISTRY: UnresolvedRegistry,
  MANIFEST_READ_ERROR: ManifestReadError,
  MANIFEST_WRITE_ERROR: ManifestWriteError,
};

