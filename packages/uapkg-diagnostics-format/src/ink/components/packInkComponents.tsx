import type { UpluginMissingDiagnostic } from '@uapkg/diagnostics';
import { Text } from 'ink';
import type { ReactElement } from 'react';
import type { DiagnosticBodyProps, DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

function UpluginMissing({ diagnostic }: DiagnosticBodyProps): ReactElement {
  const data = (diagnostic as UpluginMissingDiagnostic).data;
  return (
    <Text>
      No <Text color="yellow">*.uplugin</Text> file found in <Text color="cyan">{data.pluginRoot}</Text>.
    </Text>
  );
}

export const packInkComponents: DiagnosticInkComponentMap = {
  UPLUGIN_MISSING: UpluginMissing,
};
