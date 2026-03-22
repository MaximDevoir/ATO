import { describe, expect, it } from 'vitest';
import type { ATCEvent } from '../src';
import { ATISimpleReporter } from '../src';
import { createATITerminalState, updateATITerminalState } from '../src/terminal/ATITerminalState';

function applyEvent(state: ReturnType<typeof createATITerminalState>, reporter: ATISimpleReporter, event: ATCEvent) {
  reporter.addEvent(event);
  return updateATITerminalState(state, reporter, event);
}

describe('ATITerminalState', () => {
  it('flushes a completed test immediately when TestFinished is received', () => {
    const reporter = new ATISimpleReporter();
    let state = createATITerminalState();

    applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-1',
      sequence: -1,
      timestamp: 0,
      type: 'SessionStarted',
      coordinatorMode: 'Standalone',
    });

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-1',
      sequence: 0,
      timestamp: 1,
      type: 'TestStarted',
      testPath: 'ATC.Sample.IMMEDIATE_FLUSH.',
      invocationIndex: 0,
      requiredClients: 0,
    }).state;

    const finishedUpdate = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-1',
      sequence: 1,
      timestamp: 2,
      type: 'TestFinished',
      testPath: 'ATC.Sample.IMMEDIATE_FLUSH.',
      success: true,
      skipped: false,
      durationSeconds: 1,
      message: 'done',
    });

    expect(finishedUpdate.state.currentTest).toBeUndefined();
    expect(finishedUpdate.flushedTest).toBeDefined();
    expect(finishedUpdate.flushedTest?.simpleName).toBe('IMMEDIATE_FLUSH');
    expect(finishedUpdate.flushedTest?.status).toBe('passed');
    expect(finishedUpdate.flushedTest?.phase).toBe('Completed');
  });
});
