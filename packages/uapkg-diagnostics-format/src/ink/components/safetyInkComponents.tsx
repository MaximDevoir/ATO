import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type {
  SafetyOverriddenByForceDiagnostic,
  SafetyPathNotProjectManifestDiagnostic,
  SafetyTargetExistsNoManifestDiagnostic,
} from '@uapkg/diagnostics';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function TargetExistsNoManifest({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as SafetyTargetExistsNoManifestDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{data.path}</Text> exists but has no <Text color="cyan">uapkg.json</Text>.
      </Text>
      <Text>Package: <Text color="cyan">{data.packageName}</Text></Text>
    </Box>
  );
}

function PathNotProjectManifest({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as SafetyPathNotProjectManifestDiagnostic).data;
  return (
    <Box flexDirection="column">
      <Text>
        Plugin <Text color="cyan">{data.pluginName}</Text> requested a custom install path
        for <Text color="cyan">{data.dependencyName}</Text>:
      </Text>
      <Text>Requested: <Text color="yellow">{data.requestedPath}</Text></Text>
      <Text>Using:     <Text color="green">{data.fallbackPath}</Text></Text>
    </Box>
  );
}

function OverriddenByForce({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as SafetyOverriddenByForceDiagnostic).data;
  return (
    <Text>
      Policy <Text color="yellow">{data.policy}</Text> bypassed for{' '}
      <Text color="cyan">{data.packageName}</Text> via --force.
    </Text>
  );
}

export const safetyInkComponents: DiagnosticInkComponentMap = {
  SAFETY_TARGET_EXISTS_NO_MANIFEST: TargetExistsNoManifest,
  SAFETY_PATH_NOT_PROJECT_MANIFEST: PathNotProjectManifest,
  SAFETY_OVERRIDDEN_BY_FORCE: OverriddenByForce,
};

