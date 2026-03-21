import type { IATIConsumer } from '../ATIConsumer';
import type { ATCEvent } from '../ATIEvents';

export class TerminalConsumer implements IATIConsumer {
  readonly id = 'terminal';

  onEvent(event: ATCEvent) {
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
