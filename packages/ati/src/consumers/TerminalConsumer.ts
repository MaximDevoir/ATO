import type { IATIConsumer } from '../ATIConsumer.js';
import type { ATCEvent } from '../ATIEvents.js';
import { ATISimpleReporter } from '../ATISimpleReporter.js';
import { ATITerminalReporter } from '../terminal/ATITerminalReporter.js';
import {
  type ATITerminalDisplayedTest,
  type ATITerminalFormattedLine,
  createATITerminalState,
  flushATITerminalState,
  formatATITerminalDisplayedTestSummary,
  formatATITerminalSessionSummary,
  updateATITerminalState,
} from '../terminal/ATITerminalState.js';

export type ATITerminalReporterMode = 'default' | 'basic';

type TerminalLineWriter = (line: string) => void;

function writeTerminalLine(writer: TerminalLineWriter | undefined, line: string) {
  if (writer) {
    writer(line);
    return;
  }

  console.log(line);
}

export type TerminalConsumerOptions = {
  reporter?: ATISimpleReporter;
  mode?: ATITerminalReporterMode;
  isTTY?: boolean;
  writeLog?: TerminalLineWriter;
  writeWarn?: TerminalLineWriter;
  writeError?: TerminalLineWriter;
};

export class TerminalConsumer implements IATIConsumer {
  readonly id = 'terminal';
  readonly reporter: ATISimpleReporter;
  private readonly mode: ATITerminalReporterMode;
  private readonly terminalReporter?: ATITerminalReporter;
  private state = createATITerminalState();
  private completedTests: ATITerminalDisplayedTest[] = [];
  private ended = false;

  constructor(private readonly options: TerminalConsumerOptions = {}) {
    this.reporter = options.reporter ?? new ATISimpleReporter();
    this.mode = options.mode ?? 'basic';
    if (this.mode === 'default') {
      this.terminalReporter = new ATITerminalReporter({
        reporter: this.reporter,
        isTTY: options.isTTY,
        writeLog: options.writeLog,
        writeWarn: options.writeWarn,
        writeError: options.writeError,
      });
    }
  }

  onStart() {
    this.terminalReporter?.start();
  }

  onEvent(event: ATCEvent) {
    this.reporter.addEvent(event);

    if (this.mode === 'default') {
      return;
    }

    const update = updateATITerminalState(this.state, this.reporter, event);
    this.state = update.state;
    if (update.flushedTest) {
      this.appendCompletedTest(update.flushedTest);
    }
  }

  onEnd() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.terminalReporter?.stop();
    if (this.mode === 'basic') {
      const flushed = flushATITerminalState(this.state, this.reporter);
      this.state = flushed.state;
      if (flushed.flushedTest) {
        this.appendCompletedTest(flushed.flushedTest);
      }

      for (const test of this.completedTests) {
        if (test.status !== 'passed' && test.status !== 'skipped') {
          this.writeFormattedLines(formatATITerminalDisplayedTestSummary(test));
        }
      }

      writeTerminalLine(this.options.writeLog, formatATITerminalSessionSummary(this.reporter.getSession()));
    }
  }

  dispose() {
    this.terminalReporter?.dispose();
    this.onEnd();
  }

  private writeFormattedLines(lines: ATITerminalFormattedLine[]) {
    for (const line of lines) {
      switch (line.level) {
        case 'error':
          writeTerminalLine(this.options.writeError, line.line);
          break;
        case 'warn':
          writeTerminalLine(this.options.writeWarn, line.line);
          break;
        default:
          writeTerminalLine(this.options.writeLog, line.line);
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
