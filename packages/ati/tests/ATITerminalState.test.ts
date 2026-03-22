import { describe, expect, it } from 'vitest';
import type { ATCEvent } from '../src';
import {
  ATISimpleReporter,
  createATITerminalState,
  formatATITerminalDisplayedTestSummary,
  updateATITerminalState,
} from '../src';

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

  it('formats end-of-run summaries using the displayed test structure', () => {
    const lines = formatATITerminalDisplayedTestSummary({
      key: 'ATC.Sample.TEST::0',
      testPath: 'ATC.Sample.TEST.',
      simpleName: 'TEST',
      coordinatorMode: 'Standalone',
      phase: 'Completed',
      runLabel: '[2/2]',
      status: 'failed',
      messages: [
        { id: 'warn-1', level: 'warn', line: 'warning text (Source/Test.cpp:12)' },
        { id: 'error-1', level: 'error', line: 'error text (Source/Test.cpp:18)' },
        { id: 'log-1', level: 'log', line: 'debug text' },
      ],
    });

    expect(lines).toEqual([
      { level: 'log', line: 'X TEST Standalone | Completed | [2/2]' },
      { level: 'warn', line: '  warning text (Source/Test.cpp:12)' },
      { level: 'error', line: '  error text (Source/Test.cpp:18)' },
    ]);
  });
});
