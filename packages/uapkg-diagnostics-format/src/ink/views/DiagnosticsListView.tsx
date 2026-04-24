import type { ReactElement } from 'react';
import { Box } from 'ink';
import type { Diagnostic } from '@uapkg/diagnostics';
import type { IDiagnosticInkRegistry } from '../contracts/InkTypes.js';
import { DiagnosticView } from './DiagnosticView.js';

export interface DiagnosticsListViewProps {
  readonly diagnostics: readonly Diagnostic[];
  readonly registry: IDiagnosticInkRegistry;
}

/**
 * Renders a list of diagnostics (already pre-sorted by the caller — usually
 * severity-descending). Produces nothing for an empty input so the host
 * Ink tree stays quiet.
 */
export function DiagnosticsListView({ diagnostics, registry }: DiagnosticsListViewProps): ReactElement | null {
  if (diagnostics.length === 0) return null;
  return (
    <Box flexDirection="column">
      {diagnostics.map((d, i) => {
        // Diagnostics don't carry stable ids; the (code, message, index) triple
        // is stable for a one-shot static render and unique within the list.
        const key = `${d.code}:${i}:${d.message.length}`;
        return <DiagnosticView key={key} diagnostic={d} registry={registry} />;
      })}
    </Box>
  );
}


