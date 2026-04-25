import type { Diagnostic } from '@uapkg/diagnostics';
import { Text } from 'ink';
import React, { type ReactElement } from 'react';

const LEVEL_CONFIG: Record<Diagnostic['level'], { readonly icon: string; readonly color: string }> = {
  error: { icon: '✖', color: 'red' },
  warning: { icon: '⚠', color: 'yellow' },
  info: { icon: 'ℹ', color: 'cyan' },
};

export interface SeverityBadgeProps {
  readonly level: Diagnostic['level'];
}

/**
 * A single colored severity icon. Pure presentation — no diagnostic-specific
 * logic lives here. Used as a prefix by {@link DiagnosticView}.
 */
export function SeverityBadge({ level }: SeverityBadgeProps): ReactElement {
  const { icon, color } = LEVEL_CONFIG[level];
  return <Text color={color}>{icon}</Text>;
}
