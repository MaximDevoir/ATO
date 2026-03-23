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

  it('shows later repeat runs as running until the active run completes', () => {
    const reporter = new ATISimpleReporter();
    let state = createATITerminalState();

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: -1,
      timestamp: 0,
      type: 'SessionStarted',
      coordinatorMode: 'Dedicated',
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 0,
      timestamp: 1,
      type: 'TestRepeat',
      testId: 'ATC.Sample.REPEAT|Invocation=0|Run=1',
      testPath: 'ATC.Sample.REPEAT',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      invocationIndex: 0,
      state: 'RunStart',
      currentRun: 1,
      totalRuns: 2,
      repeatMode: 'Count',
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 1,
      timestamp: 2,
      type: 'TestStarted',
      testId: 'travel-repeat-1',
      testPath: 'ATC.Sample.REPEAT',
      travelSessionId: 'travel-repeat-1',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      invocationIndex: 0,
      requiredClients: 1,
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 2,
      timestamp: 3,
      type: 'TestFinished',
      testId: 'travel-repeat-1',
      testPath: 'ATC.Sample.REPEAT',
      travelSessionId: 'travel-repeat-1',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      success: true,
      skipped: false,
      durationSeconds: 1,
      message: 'first run done',
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 3,
      timestamp: 4,
      type: 'TestRepeat',
      testId: 'ATC.Sample.REPEAT|Invocation=0|Run=1',
      testPath: 'ATC.Sample.REPEAT',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      invocationIndex: 0,
      state: 'RunEnd',
      currentRun: 1,
      totalRuns: 2,
      repeatMode: 'Count',
      failed: false,
      skipped: false,
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 4,
      timestamp: 5,
      type: 'TestRepeat',
      testId: 'ATC.Sample.REPEAT|Invocation=0|Run=2',
      testPath: 'ATC.Sample.REPEAT',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      invocationIndex: 0,
      state: 'RunStart',
      currentRun: 2,
      totalRuns: 2,
      repeatMode: 'Count',
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 5,
      timestamp: 6,
      type: 'TestStarted',
      testId: 'travel-repeat-2',
      testPath: 'ATC.Sample.REPEAT',
      travelSessionId: 'travel-repeat-2',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      invocationIndex: 0,
      requiredClients: 1,
    }).state;

    state = applyEvent(state, reporter, {
      version: 1,
      sessionId: 'session-repeat-terminal',
      sequence: 6,
      timestamp: 7,
      type: 'TestPhaseChanged',
      testId: 'travel-repeat-2',
      testPath: 'ATC.Sample.REPEAT',
      travelSessionId: 'travel-repeat-2',
      coordinatorMode: 'Dedicated',
      effectiveCoordinatorMode: 'Dedicated',
      phase: 'Traveling',
    }).state;

    expect(state.currentTest).toMatchObject({
      simpleName: 'REPEAT',
      coordinatorMode: 'Dedicated',
      phase: 'Traveling',
      runLabel: '[2/2]',
      status: 'running',
    });
  });
});
