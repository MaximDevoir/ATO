import type {
  ConfigInvalidJsonDiagnostic,
  ConfigInvalidValueDiagnostic,
  ConfigTypeMismatchDiagnostic,
  ConfigUnknownKeyDiagnostic,
  ConfigUnresolvedDefaultRegistryDiagnostic,
} from '@uapkg/diagnostics';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function ConfigInvalidJson({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ConfigInvalidJsonDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        File: <Text color="cyan">{data.filePath}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function ConfigTypeMismatch({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ConfigTypeMismatchDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Path: <Text color="cyan">{data.path}</Text>
      </Text>
      <Text>
        Expected: <Text color="yellow">{data.expectedType}</Text> | Actual:{' '}
        <Text color="yellow">{data.actualType}</Text>
      </Text>
      <Text color="gray">Source: {data.source}</Text>
      {data.filePath ? <Text color="gray">File: {data.filePath}</Text> : null}
    </Box>
  );
}

function ConfigUnknownKey({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ConfigUnknownKeyDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Key: <Text color="cyan">{data.path}</Text>
      </Text>
      <Text color="gray">Source: {data.source}</Text>
      {data.filePath ? <Text color="gray">File: {data.filePath}</Text> : null}
    </Box>
  );
}

function ConfigUnresolvedDefaultRegistry({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ConfigUnresolvedDefaultRegistryDiagnostic).data;
  return (
    <Text>
      Default registry <Text color="yellow">{data.registryName}</Text> is not defined in registries.
    </Text>
  );
}

function ConfigInvalidValue({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as ConfigInvalidValueDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Path: <Text color="cyan">{data.path}</Text>
      </Text>
      <Text color="gray">{data.rule}</Text>
    </Box>
  );
}

export const configInkComponents: DiagnosticInkComponentMap = {
  CONFIG_INVALID_JSON: ConfigInvalidJson,
  CONFIG_TYPE_MISMATCH: ConfigTypeMismatch,
  CONFIG_UNKNOWN_KEY: ConfigUnknownKey,
  CONFIG_UNRESOLVED_DEFAULT_REGISTRY: ConfigUnresolvedDefaultRegistry,
  CONFIG_INVALID_VALUE: ConfigInvalidValue,
};
