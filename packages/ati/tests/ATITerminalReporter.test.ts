import { afterEach, describe, expect, it, vi } from 'vitest';

const inkMocks = vi.hoisted(() => {
  const rerender = vi.fn();
  const unmount = vi.fn();
  const render = vi.fn(() => ({ rerender, unmount }));
  return { render, rerender, unmount };
});

vi.mock('ink', () => ({
  Box: () => null,
  Static: () => null,
  Text: () => null,
  render: inkMocks.render,
}));

import { TerminalConsumer } from '../src';

afterEach(() => {
  inkMocks.render.mockClear();
  inkMocks.rerender.mockClear();
  inkMocks.unmount.mockClear();
});

describe('ATITerminalReporter', () => {
  it('does not replay flushed warnings and errors through plain writers in default mode', () => {
    const logLines: string[] = [];
    const warnLines: string[] = [];
    const errorLines: string[] = [];
    const consumer = new TerminalConsumer({
      mode: 'default',
      isTTY: true,
      writeLog: (line) => logLines.push(line),
      writeWarn: (line) => warnLines.push(line),
      writeError: (line) => errorLines.push(line),
    });

    consumer.onStart?.();
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: -1,
      timestamp: 0,
      type: 'SessionStarted',
      coordinatorMode: 'Standalone',
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: 0,
      timestamp: 1,
      type: 'TestStarted',
      testPath: 'ATC.Sample.UI_DUPLICATE.',
      invocationIndex: 0,
      requiredClients: 0,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: 1,
      timestamp: 2,
      type: 'Message',
      testPath: 'ATC.Sample.UI_DUPLICATE.',
      kind: 'Warning',
      message: 'warning text',
      planName: 'PlanA',
      taskName: 'TaskA',
      sourceFile: 'Source/Test.cpp',
      sourceLine: 12,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: 2,
      timestamp: 3,
      type: 'Message',
      testPath: 'ATC.Sample.UI_DUPLICATE.',
      kind: 'NonFatalError',
      message: 'error text',
      planName: 'PlanA',
      taskName: 'TaskA',
      sourceFile: 'Source/Test.cpp',
      sourceLine: 18,
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: 3,
      timestamp: 4,
      type: 'TestFinished',
      testPath: 'ATC.Sample.UI_DUPLICATE.',
      success: false,
      skipped: false,
      durationSeconds: 1,
      message: 'failed',
    });
    consumer.onEvent({
      version: 1,
      sessionId: 'session-ui-1',
      sequence: 4,
      timestamp: 5,
      type: 'SessionFinished',
    });
    consumer.onEnd?.();

    expect(inkMocks.render).toHaveBeenCalled();
    expect(warnLines).toEqual([]);
    expect(errorLines).toEqual([]);
    expect(logLines).toEqual(['ATI summary: 0 passed, 1 failed, 0 skipped, 1 total']);
  });
});
