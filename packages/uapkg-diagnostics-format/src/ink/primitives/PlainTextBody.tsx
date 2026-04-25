import { Text } from 'ink';
import React, { type ReactElement } from 'react';
import type { DiagnosticBodyProps } from '../contracts/InkTypes.js';

/**
 * Fallback body used when no family-specific component is registered for a
 * diagnostic code. Writes the diagnostic message verbatim so the Ink render
 * stays in structural parity with the plain-text formatter.
 */
export function PlainTextBody({ diagnostic }: DiagnosticBodyProps): ReactElement {
  return <Text>{diagnostic.message}</Text>;
}
