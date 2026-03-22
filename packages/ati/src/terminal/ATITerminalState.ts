import type { ATCEvent, ATCMessageEvent } from '../ATIEvents';
import type { ATISession, ATISimpleReporter, ATITest } from '../ATISimpleReporter';

export type ATITerminalMessageLevel = 'log' | 'warn' | 'error';
export type ATITerminalDisplayedStatus = 'running' | 'passed' | 'failed' | 'skipped';

export interface ATITerminalMessageLine {
  id: string;
  level: ATITerminalMessageLevel;
  line: string;
}

export interface ATITerminalDisplayedTest {
  key: string;
  testPath: string;
  simpleName: string;
  coordinatorMode: string;
  phase: string;
  runLabel: string;
  status: ATITerminalDisplayedStatus;
  messages: ATITerminalMessageLine[];
}

export interface ATITerminalState {
  currentTest?: ATITerminalDisplayedTest;
  lastTest?: ATITerminalDisplayedTest;
}

export interface ATITerminalStateUpdate {
  state: ATITerminalState;
  flushedTest?: ATITerminalDisplayedTest;
}

function trimTrailingDot(value: string) {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

function resolveSimpleTestName(testPath: string) {
  const parts = trimTrailingDot(testPath)
    .split('.')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return testPath;
  }

  const lastPart = parts.at(-1) ?? testPath;
  if (!lastPart.startsWith('[') || parts.length === 1) {
    return lastPart;
  }

  return `${parts.at(-2) ?? lastPart} ${lastPart}`;
}

function findTest(session: ATISession | undefined, key: string) {
  return session?.tests.get(key);
}

function resolveRunLabel(test: ATITest | undefined) {
  const currentRun = test?.currentRunIndex ?? 1;
  const totalRuns = test?.maxRuns ?? test?.runs.length ?? 1;
  return totalRuns > 1 ? `[${currentRun}/${totalRuns}]` : ``;
}

function resolveStatus(test: ATITest | undefined, fallback: ATITerminalDisplayedStatus) {
  if (!test?.result) {
    return fallback;
  }

  if (test.result.skipped) {
    return 'skipped';
  }

  return test.result.success ? 'passed' : 'failed';
}

function formatLocation(event: Pick<ATCMessageEvent, 'sourceFile' | 'sourceLine'>) {
  if (!event.sourceFile) {
    return undefined;
  }

  if (event.sourceLine === undefined) {
    return event.sourceFile;
  }

  return `${event.sourceFile}:${event.sourceLine}`;
}

function formatMessageLine(event: ATCMessageEvent): ATITerminalMessageLine {
  const location = formatLocation(event);
  const line = location ? `${event.message} (${location})` : event.message;
  const id = `${Date.now()}-${Math.random()}`;
  let level: ATITerminalMessageLevel;
  switch (event.kind) {
    case 'FatalError':
    case 'NonFatalError':
      level = 'error';
      break;
    case 'Warning':
    case 'Skip':
      level = 'warn';
      break;
    default:
      level = 'log';
  }
  return {
    id,
    level,
    line,
  };
}

function isMessageEvent(event: ATCEvent): event is ATCMessageEvent {
  return event.type === 'Message' && typeof event.message === 'string' && typeof event.kind === 'string';
}

function cloneMessages(messages: ATITerminalMessageLine[]) {
  return messages.map((message) => ({ ...message }));
}

function buildDisplayedTest(
  testPath: string,
  key: string,
  reporter: ATISimpleReporter,
  existingMessages: ATITerminalMessageLine[],
) {
  const test = findTest(reporter.getSession(), key);
  return {
    key,
    testPath,
    simpleName: resolveSimpleTestName(testPath),
    coordinatorMode: test?.coordinatorMode || 'Unknown Mode',
    phase: test?.phase ?? 'Queued',
    runLabel: resolveRunLabel(test),
    status: resolveStatus(test, 'running'),
    messages: cloneMessages(existingMessages),
  } satisfies ATITerminalDisplayedTest;
}

function updateCurrentTest(
  currentTest: ATITerminalDisplayedTest | undefined,
  reporter: ATISimpleReporter,
  updater: (current: ATITerminalDisplayedTest) => ATITerminalDisplayedTest,
) {
  if (!currentTest) {
    return undefined;
  }

  const refreshed = buildDisplayedTest(currentTest.testPath, currentTest.key, reporter, currentTest.messages);
  return updater(refreshed);
}

function flushCurrentTest(state: ATITerminalState, reporter: ATISimpleReporter) {
  if (!state.currentTest) {
    return { state, flushedTest: undefined } satisfies ATITerminalStateUpdate;
  }

  const flushedTest = buildDisplayedTest(
    state.currentTest.testPath,
    state.currentTest.key,
    reporter,
    state.currentTest.messages,
  );

  return {
    flushedTest,
    state: {
      currentTest: undefined,
      lastTest: flushedTest,
    },
  } satisfies ATITerminalStateUpdate;
}

export function createATITerminalState(): ATITerminalState {
  return {};
}

export function updateATITerminalState(
  state: ATITerminalState,
  reporter: ATISimpleReporter,
  event: ATCEvent,
): ATITerminalStateUpdate {
  switch (event.type) {
    case 'TestStarted': {
      const testPath = event.testPath;
      if (!testPath) {
        return { state };
      }

      const nextKey = `${testPath}::${event.invocationIndex ?? 0}`;
      if (state.currentTest?.key === nextKey) {
        return {
          state: {
            ...state,
            currentTest: buildDisplayedTest(testPath, nextKey, reporter, state.currentTest.messages),
          },
        };
      }

      const flushed = flushCurrentTest(state, reporter);
      return {
        flushedTest: flushed.flushedTest,
        state: {
          ...flushed.state,
          currentTest: buildDisplayedTest(testPath, nextKey, reporter, []),
        },
      };
    }
    case 'TestPhaseChanged': {
      const nextCurrentTest = updateCurrentTest(state.currentTest, reporter, (current) => ({
        ...current,
        phase: typeof event.phase === 'string' ? event.phase : current.phase,
      }));
      return { state: { ...state, currentTest: nextCurrentTest } };
    }
    case 'TestRepeat': {
      const nextCurrentTest = updateCurrentTest(state.currentTest, reporter, (current) => ({
        ...current,
        runLabel: buildDisplayedTest(current.testPath, current.key, reporter, current.messages).runLabel,
      }));
      return { state: { ...state, currentTest: nextCurrentTest } };
    }
    case 'TestFinished': {
      const nextCurrentTest = updateCurrentTest(state.currentTest, reporter, (current) => ({
        ...current,
        phase: 'Completed',
        status: resolveStatus(findTest(reporter.getSession(), current.key), current.status),
        runLabel: buildDisplayedTest(current.testPath, current.key, reporter, current.messages).runLabel,
      }));

      if (!nextCurrentTest) {
        return { state };
      }

      return {
        flushedTest: nextCurrentTest,
        state: {
          ...state,
          currentTest: undefined,
          lastTest: nextCurrentTest,
        },
      };
    }
    case 'Message': {
      if (!isMessageEvent(event) || event.testPath !== state.currentTest?.testPath) {
        return { state };
      }

      const currentTest = state.currentTest;
      if (!currentTest) {
        return { state };
      }

      return {
        state: {
          ...state,
          currentTest: {
            ...currentTest,
            messages: [...currentTest.messages, formatMessageLine(event)],
          },
        },
      };
    }
    case 'SessionFinished':
      return flushCurrentTest(state, reporter);
    default: {
      const nextCurrentTest = updateCurrentTest(state.currentTest, reporter, (current) => current);
      return nextCurrentTest ? { state: { ...state, currentTest: nextCurrentTest } } : { state };
    }
  }
}
