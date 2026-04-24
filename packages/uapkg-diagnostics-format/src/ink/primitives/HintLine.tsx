import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

export interface HintLineProps {
  readonly hint: string;
}

/**
 * Bottom-of-diagnostic actionable hint. Always indented and tinted so it
 * stands apart from the body. Renders nothing when the hint is empty.
 */
export function HintLine({ hint }: HintLineProps): ReactElement | null {
  if (!hint || hint.length === 0) return null;
  return (
    <Box marginLeft={2}>
      <Text color="magentaBright">→ </Text>
      <Text color="white">{hint}</Text>
    </Box>
  );
}
