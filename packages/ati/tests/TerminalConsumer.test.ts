import { describe, expect, it } from 'vitest';
import { TerminalConsumer } from '../src/consumers/TerminalConsumer';

describe('TerminalConsumer', () => {
  it('flushes completed default-reporter messages and prints a session summary', () => {
    const logLines: string[] = [];
    const warnLines: string[] = [];
    const errorLines: string[] = [];
    const consumer = new TerminalConsumer({
      mode: 'default',
      isTTY: false,
      writeLog: (line) => logLines.push(line),
      writeWarn: (line) => warnLines.push(line),
      writeError: (line) => errorLines.push(line),
    });

    consumer.onStart?.();
    consumer.onEvent({ version: 1, sessionId: 'session-1', sequence: -1, timestamp: 0, type: 'SessionStarted' });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 0,
      timestamp: 1,
      type: 'TestStarted',
      testPath: 'ATC.Sample.TEST_NAME.',
      invocationIndex: 0,
      requiredClients: 0,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 1,
      timestamp: 2,
      type: 'TestPhaseChanged',
      testPath: 'ATC.Sample.TEST_NAME.',
      phase: 'RunningPlans',
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 2,
      timestamp: 3,
      type: 'Message',
      testPath: 'ATC.Sample.TEST_NAME.',
      kind: 'Warning',
      message: 'warning text',
      planName: 'PlanA',
      taskName: 'TaskA',
      sourceFile: 'Source/Test.cpp',
      sourceLine: 12,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 3,
      timestamp: 4,
      type: 'Message',
      testPath: 'ATC.Sample.TEST_NAME.',
      kind: 'NonFatalError',
      message: 'error text',
      planName: 'PlanA',
      taskName: 'TaskA',
      sourceFile: 'Source/Test.cpp',
      sourceLine: 18,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 4,
      timestamp: 5,
      type: 'TestFinished',
      testPath: 'ATC.Sample.TEST_NAME.',
      success: false,
      skipped: false,
      durationSeconds: 1,
      message: 'failed',
    });
    consumer.onEvent({ version: 1, sessionId: 'session-1', sequence: 5, timestamp: 6, type: 'SessionFinished' });
    consumer.onEnd?.();

    expect(warnLines).toContain('warning text (Source/Test.cpp:12)');
    expect(errorLines).toContain('error text (Source/Test.cpp:18)');
    expect(logLines).toContain('ATI summary: 0 passed, 1 failed, 0 skipped, 1 total');
  });

  it('keeps the basic reporter as the existing line printer', () => {
    const logLines: string[] = [];
    const consumer = new TerminalConsumer({
      mode: 'basic',
      echoToConsole: true,
      writeLog: (line) => logLines.push(line),
    });

    consumer.onEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: 0,
      timestamp: 1,
      type: 'TaskResult',
      testPath: 'ATC.Sample',
      planName: 'PlanA',
      taskName: 'TaskA',
      success: true,
      skipped: false,
    });

    expect(logLines).toEqual(['[ATI][TaskResult] ATC.Sample PlanA.TaskA PASS']);
  });
});
