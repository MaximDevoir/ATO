import type {
  InvalidOrgNameDiagnostic,
  InvalidPackageSpecDiagnostic,
  InvalidVersionRangeDiagnostic,
} from '@uapkg/diagnostics';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function InvalidPackageSpec({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as InvalidPackageSpecDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Input: <Text color="yellow">{data.input}</Text>
      </Text>
      <Text color="gray">{data.reason}</Text>
    </Box>
  );
}

function InvalidOrgName({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as InvalidOrgNameDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Input: <Text color="yellow">{data.input}</Text>
      </Text>
      <Text>
        Bad org: <Text color="red">{data.org}</Text>
      </Text>
    </Box>
  );
}

function InvalidVersionRange({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as InvalidVersionRangeDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Input: <Text color="yellow">{data.input}</Text>
      </Text>
      <Text>
        Bad range: <Text color="red">{data.range}</Text>
      </Text>
    </Box>
  );
}

export const specInkComponents: DiagnosticInkComponentMap = {
  INVALID_PACKAGE_SPEC: InvalidPackageSpec,
  INVALID_ORG_NAME: InvalidOrgName,
  INVALID_VERSION_RANGE: InvalidVersionRange,
};
