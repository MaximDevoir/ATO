import { describe, expect, it } from 'vitest';
import type { ATCEvent } from '../src';
import { ATISimpleReporter } from '../src';

function addEvents(reporter: ATISimpleReporter, events: ATCEvent[]) {
  for (const event of events) {
    reporter.addEvent(event);
  }
}

describe('ATISimpleReporter', () => {
  it('builds a repeat-run task tree with separated assertion errors and warnings', () => {
    const reporter = new ATISimpleReporter();

    addEvents(reporter, [
      {
        version: 1,
        sessionId: 'session-1',
        sequence: -1,
        timestamp: 0,
        type: 'SessionStarted',
        coordinatorMode: 'Standalone',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 0,
        timestamp: 1,
        type: 'TestRepeat',
        testId: 'ATC.Sample|Invocation=0|Run=1',
        testPath: 'ATC.Sample',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        invocationIndex: 0,
        state: 'RunStart',
        currentRun: 1,
        totalRuns: 2,
        repeatMode: 'Count',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 1,
        timestamp: 2,
        type: 'TestStarted',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        invocationIndex: 0,
        requiredClients: 0,
        parameters: [{ name: 'Clients', value: '0' }],
        metadata: [{ name: 'automationLabel', value: '' }],
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 2,
        timestamp: 3,
        type: 'PlanStarted',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 3,
        timestamp: 4,
        type: 'TaskDispatched',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        taskTarget: 'Coordinator',
        taskRole: 'Server',
        attempt: 1,
        maxRetries: 2,
        retryDelaySeconds: 0.25,
        taskTimeoutSeconds: 30,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 4,
        timestamp: 5,
        type: 'TaskStarted',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        attempt: 1,
        taskTarget: 'Coordinator',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 5,
        timestamp: 6,
        type: 'Message',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        kind: 'NonFatalError',
        message: 'Expected true but got false',
        sourceFile: 'Source/ATC/Test.cpp',
        sourceLine: 42,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 6,
        timestamp: 7,
        type: 'Message',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        kind: 'Warning',
        message: 'This is a warning',
        sourceFile: 'Source/ATC/Test.cpp',
        sourceLine: 43,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 7,
        timestamp: 8,
        type: 'TaskRetry',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        state: 'Scheduled',
        attempt: 1,
        failedAttempt: 1,
        nextAttempt: 2,
        retriesRemaining: 1,
        maxRetries: 2,
        delaySeconds: 0.25,
        message: 'Retrying TaskA',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 8,
        timestamp: 9,
        type: 'TaskStarted',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        attempt: 2,
        taskTarget: 'Coordinator',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 9,
        timestamp: 10,
        type: 'TaskResult',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        taskName: 'TaskA',
        attempt: 2,
        success: true,
        skipped: false,
        durationSeconds: 1,
        message: 'Success',
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 10,
        timestamp: 11,
        type: 'PlanFinished',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        planName: 'PlanA',
        success: true,
        completedTasks: 1,
        skippedTasks: 0,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 11,
        timestamp: 12,
        type: 'TestFinished',
        testId: 'travel-1',
        testPath: 'ATC.Sample',
        travelSessionId: 'travel-1',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        success: true,
        skipped: false,
        durationSeconds: 10,
        message: 'ATC test completed successfully',
        messageCount: 2,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 12,
        timestamp: 13,
        type: 'TestRepeat',
        testId: 'ATC.Sample|Invocation=0|Run=1',
        testPath: 'ATC.Sample',
        coordinatorMode: 'Standalone',
        effectiveCoordinatorMode: 'Standalone',
        invocationIndex: 0,
        state: 'RunEnd',
        currentRun: 1,
        totalRuns: 2,
        repeatMode: 'Count',
        failed: false,
        skipped: false,
      },
      {
        version: 1,
        sessionId: 'session-1',
        sequence: 13,
        timestamp: 14,
        type: 'SessionFinished',
        coordinatorMode: 'Standalone',
        durationSeconds: 14,
      },
    ]);

    const session = reporter.getSession();
    expect(session?.sessionId).toBe('session-1');
    expect(session?.coordinatorMode).toBe('Standalone');
    expect(session?.effectiveCoordinatorModes).toEqual(['Standalone']);
    expect(
      reporter.getBySimpleReporterPath([
        'testsByEffectiveCoordinatorMode',
        'Standalone',
        'ATC.Sample',
        'runs',
        0,
        'runIndex',
      ]),
    ).toBe(1);

    const test = session?.tests.get('ATC.Sample::0');
    expect(test).toBeTruthy();
    expect(test?.maxRuns).toBe(2);
    expect(test?.currentRunIndex).toBe(1);
    expect(test?.result?.message).toBe('ATC test completed successfully');

    const run = test?.runs[0];
    expect(run?.status).toBe('Passed');
    const execution = run?.executions.get('Standalone');
    expect(execution?.plans.size).toBe(1);

    const plan = execution?.plans.get('PlanA');
    expect(plan?.status).toBe('Passed');
    const task = plan?.tasks.get('TaskA');
    expect(task?.attempts).toHaveLength(2);
    expect(task?.attempts[0]?.status).toBe('Retrying');
    expect(task?.attempts[0]?.assertionErrors).toEqual([
      {
        message: 'Expected true but got false',
        file: 'Source/ATC/Test.cpp',
        line: 42,
      },
    ]);
    expect(task?.attempts[0]?.assertionWarnings).toEqual([
      {
        message: 'This is a warning',
        file: 'Source/ATC/Test.cpp',
        line: 43,
      },
    ]);
    expect(task?.attempts[1]?.status).toBe('Passed');
    expect(task?.attempts[1]?.message).toBe('Success');
  });

  it('tracks PIE matrix executions under a single logical run while indexing effective coordinator modes', () => {
    const reporter = new ATISimpleReporter();

    addEvents(reporter, [
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: -1,
        timestamp: 0,
        type: 'SessionStarted',
        coordinatorMode: 'PIE',
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 0,
        timestamp: 1,
        type: 'TestRepeat',
        testId: 'ATC.PIE.Sample|Invocation=2|Run=1',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        invocationIndex: 2,
        state: 'RunStart',
        currentRun: 1,
        totalRuns: 1,
        repeatMode: 'None',
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 1,
        timestamp: 2,
        type: 'CoordinatorMatrix',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'Dedicated',
        state: 'Modes',
        modes: ['Dedicated', 'ListenServer'],
        totalVariants: 2,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 2,
        timestamp: 3,
        type: 'CoordinatorMatrix',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'Dedicated',
        state: 'VariantStart',
        currentVariant: 1,
        totalVariants: 2,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 3,
        timestamp: 4,
        type: 'TestStarted',
        testId: 'travel-dedicated',
        testPath: 'ATC.PIE.Sample',
        travelSessionId: 'travel-dedicated',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'Dedicated',
        invocationIndex: 2,
        requiredClients: 1,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 4,
        timestamp: 5,
        type: 'TestFinished',
        testId: 'travel-dedicated',
        testPath: 'ATC.PIE.Sample',
        travelSessionId: 'travel-dedicated',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'Dedicated',
        success: true,
        skipped: false,
        durationSeconds: 1,
        message: 'Dedicated OK',
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 5,
        timestamp: 6,
        type: 'CoordinatorMatrix',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'Dedicated',
        state: 'VariantEnd',
        currentVariant: 1,
        totalVariants: 2,
        success: true,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 6,
        timestamp: 7,
        type: 'CoordinatorMatrix',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'ListenServer',
        state: 'VariantStart',
        currentVariant: 2,
        totalVariants: 2,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 7,
        timestamp: 8,
        type: 'TestStarted',
        testId: 'travel-listen',
        testPath: 'ATC.PIE.Sample',
        travelSessionId: 'travel-listen',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'ListenServer',
        invocationIndex: 2,
        requiredClients: 1,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 8,
        timestamp: 9,
        type: 'TestFinished',
        testId: 'travel-listen',
        testPath: 'ATC.PIE.Sample',
        travelSessionId: 'travel-listen',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'ListenServer',
        success: true,
        skipped: false,
        durationSeconds: 1,
        message: 'Listen OK',
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 9,
        timestamp: 10,
        type: 'CoordinatorMatrix',
        testPath: 'ATC.PIE.Sample',
        coordinatorMode: 'PIE',
        effectiveCoordinatorMode: 'ListenServer',
        state: 'VariantEnd',
        currentVariant: 2,
        totalVariants: 2,
        success: true,
      },
      {
        version: 1,
        sessionId: 'session-pie',
        sequence: 10,
        timestamp: 11,
        type: 'SessionFinished',
        coordinatorMode: 'PIE',
        modes: ['Dedicated', 'ListenServer'],
        durationSeconds: 11,
      },
    ]);

    const session = reporter.getSession();
    expect(session?.coordinatorMode).toBe('PIE');
    expect(session?.effectiveCoordinatorModes).toEqual(['PIE', 'Dedicated', 'ListenServer']);

    const test = session?.tests.get('ATC.PIE.Sample::2');
    expect(test?.effectiveCoordinatorModes).toEqual(['PIE', 'Dedicated', 'ListenServer']);

    const run = test?.runs[0];
    expect(run?.executions.size).toBe(2);
    expect(run?.executions.get('Dedicated')?.result?.message).toBe('Dedicated OK');
    expect(run?.executions.get('ListenServer')?.result?.message).toBe('Listen OK');
    expect(session?.testsByEffectiveCoordinatorMode.get('Dedicated')?.get('ATC.PIE.Sample::2')).toBe(test);
    expect(session?.testsByEffectiveCoordinatorMode.get('ListenServer')?.get('ATC.PIE.Sample::2')).toBe(test);
  });
});
