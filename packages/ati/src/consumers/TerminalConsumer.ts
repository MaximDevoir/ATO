import type { IATIConsumer } from '../ATIConsumer';
import type { ATCEvent } from '../ATIEvents';
import { ATISimpleReporter } from '../ATISimpleReporter';

export type TerminalConsumerOptions = {
  reporter?: ATISimpleReporter;
  echoToConsole?: boolean;
};

export class TerminalConsumer implements IATIConsumer {
  readonly id = 'terminal';
  readonly reporter: ATISimpleReporter;

  constructor(private readonly options: TerminalConsumerOptions = {}) {
    this.reporter = options.reporter ?? new ATISimpleReporter();
  }

  onEvent(event: ATCEvent) {
    this.reporter.addEvent(event);

    if (this.options.echoToConsole !== true) {
      return;
    }

    const scope = event.testPath ? ` ${event.testPath}` : '';
    switch (event.type) {
      case 'TaskResult':
        console.log(
          `[ATI][TaskResult]${scope} ${String(event.planName ?? '<Plan>')}.${String(event.taskName ?? '<Task>')} ${event.success ? 'PASS' : 'FAIL'}`,
        );
        return;
      case 'Message':
        console.log(`[ATI][Message]${scope} ${String(event.kind)}: ${String(event.message)}`);
        return;
      default:
        console.log(`[ATI][${event.type}]${scope}`);
    }
  }
}
