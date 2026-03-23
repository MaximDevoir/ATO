import { Box, render, Static, Text } from 'ink';
// biome-ignore lint/style/useImportType: React is required at runtime for JSX
import React, { useEffect, useState } from 'react';
import type { ATISimpleReporter } from '../ATISimpleReporter';
import type {
  ATITerminalDisplayedStatus,
  ATITerminalDisplayedTest,
  ATITerminalMessageLine,
  ATITerminalState,
} from './ATITerminalState';
import { createATITerminalState, formatATITerminalSessionSummary, updateATITerminalState } from './ATITerminalState';

const spinnerFrames = ['-', '\\', '|', '/'] as const;
const spinnerIntervalMs = 80;

type TerminalLineWriter = (line: string) => void;

type CompletedTestsStaticProps = {
  tests: readonly ATITerminalDisplayedTest[];
};

type ReporterAppProps = Readonly<{
  state: ATITerminalState;
  completedTests: readonly ATITerminalDisplayedTest[];
}>;

export interface ATITerminalReporterOptions {
  reporter: ATISimpleReporter;
  isTTY?: boolean;
  writeLog?: TerminalLineWriter;
  writeWarn?: TerminalLineWriter;
  writeError?: TerminalLineWriter;
}

function writeWithFallback(
  writer: TerminalLineWriter | undefined,
  fallback: (...args: unknown[]) => void,
  line: string,
) {
  if (writer) {
    writer(line);
    return;
  }

  fallback(line);
}

function statusColor(status: ATITerminalDisplayedStatus) {
  switch (status) {
    case 'passed':
      return 'green';
    case 'failed':
      return 'red';
    case 'skipped':
      return 'yellow';
    default:
      return 'cyan';
  }
}

function statusSymbol(status: ATITerminalDisplayedStatus) {
  switch (status) {
    case 'passed':
      return 'OK';
    case 'failed':
      return 'X';
    case 'skipped':
      return '!';
    default:
      return '>';
  }
}

function SpinnerText() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((currentFrame) => (currentFrame + 1) % spinnerFrames.length);
    }, spinnerIntervalMs);

    return () => {
      clearInterval(timer);
    };
  }, []);
  return <Text color="cyan">{spinnerFrames[frameIndex]}</Text>;
}

function TestStatusIcon({ status, isCurrent }: Readonly<{ status: ATITerminalDisplayedStatus; isCurrent: boolean }>) {
  if (isCurrent && status === 'running') {
    return <SpinnerText />;
  }

  return <Text color={statusColor(status)}>{statusSymbol(status)}</Text>;
}

function MessageLine({ message }: Readonly<{ message: ATITerminalMessageLine }>) {
  let color: 'red' | 'yellow' | 'white' = 'white';
  if (message.level === 'error') {
    color = 'red';
  } else if (message.level === 'warn') {
    color = 'yellow';
  }

  return <Text color={color}>{message.line}</Text>;
}

function TestLine({ test, isCurrent }: Readonly<{ test: ATITerminalDisplayedTest; isCurrent: boolean }>) {
  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <TestStatusIcon status={test.status} isCurrent={isCurrent} />
        <Text bold={isCurrent}>{test.simpleName}</Text>
        <Text color="gray">{`${test.coordinatorMode}`} |</Text>
        <Text color="gray">{`${test.phase}`}</Text>
        <Text color="gray">{test.runLabel ? `| ${test.runLabel}` : ``}</Text>
      </Box>

      {test.messages.map((m) => (
        <Box key={m.id} marginLeft={2}>
          <MessageLine message={m} />
        </Box>
      ))}
    </Box>
  );
}

function CompletedTestsStatic({ tests }: Readonly<CompletedTestsStaticProps>) {
  const StaticComponent = Static as unknown as React.ComponentType<{
    items: readonly ATITerminalDisplayedTest[];
    children: (test: ATITerminalDisplayedTest) => React.ReactNode;
  }>;

  return (
    <StaticComponent items={tests}>
      {(test: ATITerminalDisplayedTest) => <TestLine key={test.key} test={test} isCurrent={false} />}
    </StaticComponent>
  );
}

function ReporterApp({ state, completedTests }: ReporterAppProps) {
  return (
    <Box flexDirection="column">
      {completedTests.length > 0 && <CompletedTestsStatic key="completed" tests={completedTests} />}

      {state.currentTest && <TestLine key="current" test={state.currentTest} isCurrent />}

      {completedTests.length === 0 && !state.currentTest && <Text color="gray">Waiting for ATI events...</Text>}
    </Box>
  );
}

export class ATITerminalReporter {
  private readonly writeLog: TerminalLineWriter;
  private readonly unsubscribe;
  private inkApp?: ReturnType<typeof render>;
  private state = createATITerminalState();
  private completedTests: ATITerminalDisplayedTest[] = [];
  private stopped = false;

  constructor(private readonly options: ATITerminalReporterOptions) {
    const isTTY =
      options.isTTY ?? (process.stdin.isTTY === true && process.stdout.isTTY === true && process.stderr.isTTY === true);
    if (!isTTY) {
      throw new Error('[ATI] ATITerminalReporter requires an interactive terminal');
    }

    this.writeLog = (line) => {
      writeWithFallback(options.writeLog, console.log, line);
    };
    this.unsubscribe = options.reporter.subscribe((event) => {
      const update = updateATITerminalState(this.state, this.options.reporter, event);
      this.state = update.state;
      if (update.flushedTest) {
        this.appendCompletedTest(update.flushedTest);
      }
      this.rerender();
    });
  }

  start() {
    if (this.inkApp) {
      return;
    }

    process.env.FORCE_COLOR ??= '1';
    try {
      this.inkApp = render(<ReporterApp state={this.state} completedTests={this.completedTests} />);
    } catch (error) {
      throw new Error(
        `[ATI] Failed to start Ink terminal UI: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  stop() {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    if (this.inkApp) {
      this.inkApp.unmount();
      this.inkApp = undefined;
    }

    this.writeLog(formatATITerminalSessionSummary(this.options.reporter.getSession()));
  }

  dispose() {
    this.unsubscribe();
    this.stop();
  }

  private rerender() {
    if (!this.inkApp) {
      this.start();
      return;
    }

    this.inkApp.rerender(<ReporterApp state={this.state} completedTests={this.completedTests} />);
  }

  private appendCompletedTest(test: ATITerminalDisplayedTest) {
    const previous = this.completedTests.at(-1);
    if (
      previous?.key === test.key &&
      previous.runLabel === test.runLabel &&
      previous.status === test.status &&
      previous.phase === test.phase
    ) {
      return;
    }

    this.completedTests = [...this.completedTests, test];
  }
}
