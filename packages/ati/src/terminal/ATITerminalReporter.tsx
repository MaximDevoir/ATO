import { Box, render, Static, Text } from 'ink';
import React, { useEffect, useState } from 'react';
import type { ATISession, ATISimpleReporter } from '../ATISimpleReporter';
import type {
  ATITerminalDisplayedStatus,
  ATITerminalDisplayedTest,
  ATITerminalMessageLine,
  ATITerminalState,
} from './ATITerminalState';
import { createATITerminalState, updateATITerminalState } from './ATITerminalState';

const spinnerFrames = ['-', '\\', '|', '/'] as const;
const spinnerIntervalMs = 80;

type TerminalLineWriter = (line: string) => void;

type CompletedTestsStaticProps = {
  tests: ATITerminalDisplayedTest[];
};

export interface ATITerminalReporterOptions {
  reporter: ATISimpleReporter;
  isTTY?: boolean;
  forceRender?: boolean;
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

  return React.createElement(Text, { color: 'cyan' }, spinnerFrames[frameIndex]);
}

function TestStatusIcon({ status, isCurrent }: { status: ATITerminalDisplayedStatus; isCurrent: boolean }) {
  if (isCurrent && status === 'running') {
    return React.createElement(SpinnerText);
  }

  return React.createElement(Text, { color: statusColor(status) }, statusSymbol(status));
}

function MessageLine({ message }: { message: ATITerminalMessageLine }) {
  const color = message.level === 'error' ? 'red' : message.level === 'warn' ? 'yellow' : 'white';

  return <Text color={color}>{message.line}</Text>;
}

function TestLine({ test, isCurrent }: { test: ATITerminalDisplayedTest; isCurrent: boolean }) {
  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <TestStatusIcon status={test.status} isCurrent={isCurrent} />
        <Text bold={isCurrent}>{test.simpleName}</Text>
        <Text color="gray">{`${test.coordinatorMode}`} | </Text>
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

function CompletedTestsStatic({ tests }: CompletedTestsStaticProps) {
  const StaticComponent = Static as unknown as React.ComponentType<{
    items: ATITerminalDisplayedTest[];
    children: (test: ATITerminalDisplayedTest) => React.ReactNode;
  }>;

  return (
    <StaticComponent items={tests}>
      {(test: ATITerminalDisplayedTest) => <TestLine key={test.key} test={test} isCurrent={false} />}
    </StaticComponent>
  );
}

function ReporterApp({
  state,
  completedTests,
}: {
  state: ATITerminalState;
  completedTests: ATITerminalDisplayedTest[];
}) {
  const children = [] as React.ReactNode[];

  if (completedTests.length > 0) {
    children.push(React.createElement(CompletedTestsStatic, { key: 'completed', tests: completedTests }));
  }

  if (state.currentTest) {
    children.push(React.createElement(TestLine, { key: 'current', test: state.currentTest, isCurrent: true }));
  }

  if (children.length === 0) {
    children.push(React.createElement(Text, { key: 'idle', color: 'gray' }, 'Waiting for ATI events...'));
  }

  return React.createElement(Box, { flexDirection: 'column' }, ...children);
}

function formatSummary(session: ATISession | undefined) {
  const tests = [...(session?.tests.values() ?? [])];
  const total = tests.length;
  const passed = tests.filter((test) => test.result?.success).length;
  const skipped = tests.filter((test) => test.result?.skipped).length;
  const failed = tests.filter((test) => test.result && !test.result.success && !test.result.skipped).length;
  return `ATI summary: ${passed} passed, ${failed} failed, ${skipped} skipped, ${total} total`;
}

export class ATITerminalReporter {
  private readonly isTTY: boolean;
  private readonly writeLog: TerminalLineWriter;
  private readonly writeWarn: TerminalLineWriter;
  private readonly writeError: TerminalLineWriter;
  private readonly unsubscribe;
  private inkEnabled: boolean;
  private inkApp?: ReturnType<typeof render>;
  private state = createATITerminalState();
  private completedTests: ATITerminalDisplayedTest[] = [];
  private stopped = false;

  constructor(private readonly options: ATITerminalReporterOptions) {
    this.isTTY = options.isTTY ?? process.stdout.isTTY;
    this.inkEnabled = options.forceRender ?? this.isTTY;
    this.writeLog = (line) => {
      writeWithFallback(options.writeLog, console.log, line);
    };
    this.writeWarn = (line) => {
      writeWithFallback(options.writeWarn, console.warn, line);
    };
    this.writeError = (line) => {
      writeWithFallback(options.writeError, console.error, line);
    };
    this.unsubscribe = options.reporter.subscribe((event) => {
      const update = updateATITerminalState(this.state, this.options.reporter, event);
      this.state = update.state;
      if (update.flushedTest) {
        this.appendCompletedTest(update.flushedTest);
      }
      this.rerender();
      if (update.flushedTest) {
        this.flushMessages(update.flushedTest.messages);
      }
    });
  }

  canRender() {
    return this.inkEnabled;
  }

  start() {
    if (!this.inkEnabled || this.inkApp) {
      if (!this.inkEnabled && !this.inkApp) {
        this.writeWarn(
          '[ATI] Default terminal UI requires an interactive terminal; falling back to basic terminal output',
        );
      }
      return;
    }

    try {
      process.env.FORCE_COLOR ??= '1';
      this.inkApp = render(
        React.createElement(ReporterApp, { state: this.state, completedTests: this.completedTests }),
      );
    } catch (error) {
      this.inkEnabled = false;
      this.writeWarn(
        `[ATI] Failed to start Ink terminal UI; falling back to buffered terminal output: ${error instanceof Error ? error.message : String(error)}`,
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

    this.writeLog(formatSummary(this.options.reporter.getSession()));
  }

  dispose() {
    this.unsubscribe();
    this.stop();
  }

  private rerender() {
    if (!this.inkEnabled) {
      return;
    }

    if (!this.inkApp) {
      this.start();
      return;
    }

    this.inkApp.rerender(React.createElement(ReporterApp, { state: this.state, completedTests: this.completedTests }));
  }

  private flushMessages(messages: ATITerminalMessageLine[]) {
    for (const message of messages) {
      switch (message.level) {
        case 'error':
          this.writeError(message.line);
          break;
        case 'warn':
          this.writeWarn(message.line);
          break;
        default:
          this.writeLog(message.line);
      }
    }
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
