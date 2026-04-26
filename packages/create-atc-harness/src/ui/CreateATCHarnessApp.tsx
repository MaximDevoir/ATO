import { Box, Static, Text } from 'ink';
// biome-ignore lint/style/useImportType: React is required at runtime for JSX
import React, { useEffect, useState } from 'react';
import type { LiveStatusModel, LiveStatusSnapshot } from './LiveStatusModel.js';

interface CreateATCHarnessAppProps {
  model: LiveStatusModel;
}

function StaticLines({ lines, color }: Readonly<{ lines: string[]; color: 'white' | 'yellow' | 'red' }>) {
  const StaticComponent = Static as unknown as React.ComponentType<{
    items: string[];
    children: (value: string) => React.ReactNode;
  }>;

  return <StaticComponent items={lines}>{(line) => <Text color={color}>{line}</Text>}</StaticComponent>;
}

export function CreateATCHarnessApp({ model }: CreateATCHarnessAppProps) {
  const [snapshot, setSnapshot] = useState<LiveStatusSnapshot>(model.getSnapshot());

  useEffect(() => model.subscribe(setSnapshot), [model]);

  return (
    <Box flexDirection="column">
      <Text color="cyan">create-atc-harness</Text>
      <Text>{snapshot.status ?? 'Starting...'}</Text>
      {snapshot.logs.length > 0 && <StaticLines lines={snapshot.logs} color="white" />}
      {snapshot.warnings.length > 0 && <StaticLines lines={snapshot.warnings} color="yellow" />}
      {snapshot.errors.length > 0 && <StaticLines lines={snapshot.errors} color="red" />}
      {snapshot.customElement}
    </Box>
  );
}
