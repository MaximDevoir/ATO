import { Box, render, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import isCI from 'is-ci';
// biome-ignore lint/correctness/noUnusedImports: Ink requires React
import React, { useState } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface PromptService {
  select(message: string, options: SelectOption[], fallbackValue: string): Promise<string>;
  text(message: string, initialValue: string): Promise<string>;
}

export class InkPromptService implements PromptService {
  constructor(private readonly isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !isCI) {}

  async select(message: string, options: SelectOption[], fallbackValue: string) {
    if (!this.isInteractive) {
      return fallbackValue;
    }

    return await new Promise<string>((resolve) => {
      const app = render(<SelectPrompt message={message} options={options} onSubmit={(value) => resolve(value)} />);
      Promise.resolve().then(() => app.waitUntilExit());
    });
  }

  async text(message: string, initialValue: string) {
    if (!this.isInteractive) {
      return initialValue;
    }

    return await new Promise<string>((resolve) => {
      const app = render(
        <TextPrompt message={message} initialValue={initialValue} onSubmit={(value) => resolve(value)} />,
      );
      Promise.resolve().then(() => app.waitUntilExit());
    });
  }
}

function SelectPrompt({
  message,
  options,
  onSubmit,
}: {
  message: string;
  options: SelectOption[];
  onSubmit(value: string): void;
}) {
  const { exit } = useApp();
  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      <SelectInput
        items={options}
        onSelect={(item) => {
          onSubmit(item.value);
          exit();
        }}
      />
    </Box>
  );
}

function TextPrompt({
  message,
  initialValue,
  onSubmit,
}: {
  message: string;
  initialValue: string;
  onSubmit(value: string): void;
}) {
  const [value, setValue] = useState(initialValue);
  const { exit } = useApp();

  useInput((_, key) => {
    if (key.return) {
      onSubmit(value.trim() || initialValue);
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      <TextInput value={value} onChange={setValue} />
      <Text color="gray">Press Enter to confirm.</Text>
    </Box>
  );
}
