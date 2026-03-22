import type { IATIConsumer } from '../ATIConsumer';
import type { ATCEvent } from '../ATIEvents';
import { ATISimpleReporter } from '../ATISimpleReporter';
import { ATITerminalReporter } from '../terminal/ATITerminalReporter';

export type ATITerminalReporterMode = 'default' | 'basic';

type TerminalLineWriter = (line: string) => void;

function writeTerminalLine(writer: TerminalLineWriter | undefined, line: string) {
  if (writer) {
    writer(line);
    return;
  }

  console.log(line);
}

function formatTaskResultLine(event: ATCEvent) {
  const candidate = event as Record<string, unknown>;
  const planName = typeof candidate.planName === 'string' ? candidate.planName : '<Plan>';
  const taskName = typeof candidate.taskName === 'string' ? candidate.taskName : '<Task>';
  const passed = typeof candidate.success === 'boolean' ? candidate.success : false;
  return `${planName}.${taskName} ${passed ? 'PASS' : 'FAIL'}`;
}

export type TerminalConsumerOptions = {
  reporter?: ATISimpleReporter;
  mode?: ATITerminalReporterMode;
  echoToConsole?: boolean;
  isTTY?: boolean;
  forceRender?: boolean;
  writeLog?: TerminalLineWriter;
  writeWarn?: TerminalLineWriter;
  writeError?: TerminalLineWriter;
};

export class TerminalConsumer implements IATIConsumer {
  readonly id = 'terminal';
  readonly reporter: ATISimpleReporter;
  private readonly mode: ATITerminalReporterMode;
  private readonly terminalReporter?: ATITerminalReporter;

  constructor(private readonly options: TerminalConsumerOptions = {}) {
    this.reporter = options.reporter ?? new ATISimpleReporter();
    this.mode = options.mode ?? 'basic';
    if (this.mode === 'default') {
      this.terminalReporter = new ATITerminalReporter({
        reporter: this.reporter,
        isTTY: options.isTTY,
        forceRender: options.forceRender,
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

    if (this.mode === 'default' && this.terminalReporter?.canRender()) {
      return;
    }

    if (this.mode !== 'default' && this.options.echoToConsole !== true) {
      return;
    }

    const scope = event.testPath ? ` ${event.testPath}` : '';
    switch (event.type) {
      case 'TaskResult':
        writeTerminalLine(this.options.writeLog, `[ATI][TaskResult]${scope} ${formatTaskResultLine(event)}`);
        return;
      case 'Message':
        writeTerminalLine(
          this.options.writeLog,
          `[ATI][Message]${scope} ${String(event.kind)}: ${String(event.message)}`,
        );
        return;
      default:
        writeTerminalLine(this.options.writeLog, `[ATI][${event.type}]${scope}`);
    }
  }

  onEnd() {
    this.terminalReporter?.stop();
  }

  dispose() {
    this.terminalReporter?.dispose();
  }
}
