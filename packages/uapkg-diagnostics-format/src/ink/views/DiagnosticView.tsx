import type { Diagnostic } from '@uapkg/diagnostics';
import { Box, Text } from 'ink';
import React, { type ReactElement } from 'react';
import type { IDiagnosticInkRegistry } from '../contracts/InkTypes.js';
import { HintLine } from '../primitives/HintLine.js';
import { PlainTextBody } from '../primitives/PlainTextBody.js';
import { SeverityBadge } from '../primitives/SeverityBadge.js';

export interface DiagnosticViewProps {
  readonly diagnostic: Diagnostic;
  readonly registry: IDiagnosticInkRegistry;
}

/**
 * Renders one diagnostic in three layers:
 *
 *   1. Header — severity badge + code + message.
 *   2. Body   — family-specific component (resolved from {@link IDiagnosticInkRegistry})
 *               or {@link PlainTextBody} as a safe fallback.
 *   3. Hint   — the `hint` field when present.
 *
 * This component is pure — it neither reads config nor talks to I/O.
 */
export function DiagnosticView({ diagnostic, registry }: DiagnosticViewProps): ReactElement {
  const Body = registry.resolve(diagnostic.code) ?? PlainTextBody;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <SeverityBadge level={diagnostic.level} />
        <Text> </Text>
        <Text bold color="whiteBright">
          {diagnostic.code}
        </Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Body diagnostic={diagnostic} />
      </Box>
      {diagnostic.hint ? <HintLine hint={diagnostic.hint} /> : null}
    </Box>
  );
}
