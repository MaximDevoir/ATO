import type { ATIContext, IATIConsumer } from '../ATIConsumer';
import type { ATCEvent } from '../ATIEvents';

export class InMemoryConsumer implements IATIConsumer {
  readonly id = 'memory';
  readonly sessions: ATIContext[] = [];
  readonly events: ATCEvent[] = [];

  onStart(ctx: ATIContext) {
    this.sessions.push(ctx);
  }

  onEvent(event: ATCEvent) {
    this.events.push(event);
  }
}
