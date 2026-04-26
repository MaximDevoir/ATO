import type { ATIContext, IATIConsumer } from '../ATIConsumer.js';
import type { ATCEvent } from '../ATIEvents.js';

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
