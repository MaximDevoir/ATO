import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ATISimpleReporter } from '@maximdevoir/ati';
import { describe, expect, it } from 'vitest';
import {
  ATO,
  composeFrameworkValidationPathName,
  FrameworkValidation,
  FrameworkValidationReporter,
  FrameworkValidationReporterController,
  formatFrameworkValidationSummaryLines,
  parseFrameworkValidationCompletedTest,
  parseFrameworkValidationEvent,
  parseFrameworkValidationEventFields,
  parseFrameworkValidationLogSource,
  parseFrameworkValidationStartedTest,
  shouldCaptureFrameworkValidationLine,
} from '../src';

function createReporter() {
  return new FrameworkValidationReporterController().enable();
}

describe('FrameworkValidationReporter', () => {
  it('stays inert while disabled', () => {
    const reporter = new FrameworkValidationReporterController();
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
    );
    reporter.observeProcessLine('DEDICATED', '[8:10:31 AM] ATC_INTERNAL_TESTS: Display: DedicatedTask!');

    expect(reporter.getReport().tests).toEqual([]);
  });

  it('parses runtime labels and automation controller start and end lines', () => {
    expect(parseFrameworkValidationLogSource('DEDICATED')).toEqual({
      type: 'Coordinator',
      coordinator: 'DEDICATED',
      label: 'DEDICATED',
    });
    expect(parseFrameworkValidationLogSource('CLIENT 7')).toEqual({
      type: 'Client',
      clientIndex: 7,
      label: 'CLIENT 7',
    });
    expect(
      parseFrameworkValidationStartedTest(
        'LogAutomationController: Display: Test Started. Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
      ),
    ).toEqual({
      name: 'ListenModeBasic.',
      path: 'ATC.COORDINATOR_DEDICATED.ListenModeBasic.',
    });
    expect(
      parseFrameworkValidationCompletedTest(
        'LogAutomationController: Display: Test Completed. Result={Success} Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
      ),
    ).toEqual({
      result: 'Success',
      name: 'ListenModeBasic.',
      path: 'ATC.COORDINATOR_DEDICATED.ListenModeBasic.',
    });
    expect(
      parseFrameworkValidationEventFields(
        'task="RecoverFromFatal" state="Scheduled" nextAttempt=2 retriesRemaining=0 message="RecoverFromFatal.FirstAttempt"',
      ),
    ).toEqual({
      task: 'RecoverFromFatal',
      state: 'Scheduled',
      nextAttempt: '2',
      retriesRemaining: '0',
      message: 'RecoverFromFatal.FirstAttempt',
    });
    expect(
      parseFrameworkValidationEvent(
        'ATC_EVENT_TASK_RETRY: Display: task="RecoverFromFatal" state="Scheduled" nextAttempt=2 retriesRemaining=0',
      ),
    ).toEqual({
      category: 'ATC_EVENT_TASK_RETRY',
      fields: {
        task: 'RecoverFromFatal',
        state: 'Scheduled',
        nextAttempt: '2',
        retriesRemaining: '0',
      },
    });
  });

  it('tracks coordinator-owned tests and captures logs from coordinator and clients', () => {
    const reporter = createReporter();

    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={[Clients=2]} Path={ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]}',
    );
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] ATC_INTERNAL_TESTS: Display: InitialLogFromDedicatedOrchestrator!',
    );
    reporter.observeProcessLine('CLIENT 0', '[8:10:32 AM] ATC_INTERNAL_TESTS: Display: LogFromZero!');
    reporter.observeProcessLine('CLIENT 1', '[8:10:33 AM] ATC_INTERNAL_TESTS: Display: LogFromOne!');
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:34 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={[Clients=2]} Path={ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]}',
    );

    const report = reporter.getReport();
    expect(report.tests).toHaveLength(1);
    expect(report.issues).toEqual([]);
    expect(report.tests[0]).toMatchObject({
      path: 'ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]',
      name: '[Clients=2]',
      pathName: composeFrameworkValidationPathName('ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]', '[Clients=2]'),
      result: 'Success',
      completed: true,
      coordinator: 'DEDICATED',
    });
    expect(report.tests[0]?.logs.map((log) => log.source)).toEqual([
      { type: 'Coordinator', coordinator: 'DEDICATED', label: 'DEDICATED' },
      { type: 'Client', clientIndex: 0, label: 'CLIENT 0' },
      { type: 'Client', clientIndex: 1, label: 'CLIENT 1' },
    ]);
  });

  it('ignores automation controller start and end lines emitted by external clients', () => {
    const reporter = createReporter();

    reporter.observeProcessLine(
      'CLIENT 0',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={0} Path={ATC.ClientBootstrap.0}',
    );
    reporter.observeProcessLine('CLIENT 0', '[8:10:31 AM] ATC_INTERNAL_TESTS: Display: Ignored!');
    reporter.observeProcessLine(
      'CLIENT 0',
      '[8:10:31 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={0} Path={ATC.ClientBootstrap.0}',
    );

    expect(reporter.getReport().tests).toEqual([]);
  });

  it('increments ordinals for repeated automation tests with the same path and name', () => {
    const reporter = createReporter();
    const startedLine =
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}';
    const completedLine =
      '[8:10:32 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}';

    reporter.observeProcessLine('DEDICATED', startedLine);
    reporter.observeProcessLine('DEDICATED', completedLine);
    reporter.observeProcessLine('DEDICATED', startedLine);
    reporter.observeProcessLine('DEDICATED', completedLine);

    expect(reporter.getReport().tests.map((test) => test.ordinal)).toEqual([1, 2]);
  });

  it('records mismatched lifecycle issues without crashing observation', () => {
    const reporter = createReporter();

    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
    );
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={Other.} Path={ATC.Other.}',
    );
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:32 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={Wrong.} Path={ATC.Wrong.}',
    );

    const report = reporter.getReport();
    expect(report.issues).toHaveLength(2);
    expect(report.issues[0]).toContain('startTest() called while test');
    expect(report.issues[1]).toContain("completed 'ATC.Wrong.Wrong.'");
  });

  it('captures ATC_INTERNAL_TESTS and future ATC_EVENT markers only', () => {
    expect(shouldCaptureFrameworkValidationLine('ATC_INTERNAL_TESTS: Display: Hello')).toBe(true);
    expect(shouldCaptureFrameworkValidationLine('LogTemp: Display: ATC_INTERNAL_TESTS: Running as Standalone')).toBe(
      true,
    );
    expect(shouldCaptureFrameworkValidationLine('ATC_EVENT_TEST_START: Display: Hello')).toBe(true);
    expect(shouldCaptureFrameworkValidationLine('LogTemp: Display: [ATC] Starting test')).toBe(false);
  });

  it('captures PIE banner lines emitted through LogTemp while a PIE-owned test is active', () => {
    const reporter = createReporter();

    reporter.observeProcessLine(
      'PIE',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={RUNS_EACH_COORDINATOR.} Path={ATC.PIE_MATRIX.MULTI_MODE.RUNS_EACH_COORDINATOR.}',
    );
    reporter.observeProcessLine('PIE', '[8:10:31 AM] LogTemp: Display: ATC_INTERNAL_TESTS: Running as Standalone');
    reporter.observeProcessLine(
      'PIE',
      '[8:10:32 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={RUNS_EACH_COORDINATOR.} Path={ATC.PIE_MATRIX.MULTI_MODE.RUNS_EACH_COORDINATOR.}',
    );

    const report = reporter.getReport();
    expect(report.tests).toHaveLength(1);
    expect(report.tests[0]?.coordinator).toBe('PIE');
    expect(report.tests[0]?.logs).toHaveLength(1);
    expect(report.tests[0]?.logs[0]?.line).toContain('Running as Standalone');
  });

  it('supports sequential and parallel validator expectations per test', () => {
    const reporter = createReporter();
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={[Clients=2]} Path={ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]}',
    );
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] ATC_EVENT_REPEAT: Display: state="RunStart" currentRun=1 totalRuns=2 repeatMode="Count"',
    );
    reporter.observeProcessLine('CLIENT 1', '[8:10:32 AM] ATC_INTERNAL_TESTS: Display: HelloFromOneParallel!');
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:33 AM] ATC_INTERNAL_TESTS: Display: HelloFromOrchestratorParallel!',
    );
    reporter.observeProcessLine('CLIENT 0', '[8:10:34 AM] ATC_INTERNAL_TESTS: Display: HelloFromZero!');
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:34 AM] ATC_EVENT_TASK_RETRY: Display: task="RecoverFromFatal" state="Scheduled" nextAttempt=2 retriesRemaining=0',
    );
    reporter.observeProcessLine(
      'DEDICATED',
      '[8:10:35 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={[Clients=2]} Path={ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]}',
    );

    const validation = new FrameworkValidation(reporter.getReport()).assertNoIssues();
    const test = validation.getTestByPath('ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]');
    test.expectResult('Success');
    expect(
      test.expectNextEvent({
        category: 'ATC_EVENT_REPEAT',
        source: { type: 'Coordinator', coordinator: 'DEDICATED' },
        fields: { state: 'RunStart', currentRun: 1, totalRuns: 2, repeatMode: 'Count' },
      }).category,
    ).toBe('ATC_EVENT_REPEAT');
    test.expectNextParallelLogs([
      { type: 'Client', clientIndex: 1, logContains: 'HelloFromOneParallel!' },
      { type: 'Coordinator', coordinator: 'DEDICATED', logContains: 'HelloFromOrchestratorParallel!' },
    ]);
    expect(test.expectNextLog({ type: 'Client', clientIndex: 0, logContains: 'HelloFromZero!' }).line).toContain(
      'HelloFromZero!',
    );
    expect(
      test.expectNextEvent({
        category: 'ATC_EVENT_TASK_RETRY',
        source: { type: 'Coordinator', coordinator: 'DEDICATED' },
        fields: { task: 'RecoverFromFatal', state: 'Scheduled', nextAttempt: 2, retriesRemaining: 0 },
      }).fields.task,
    ).toBe('RecoverFromFatal');
  });

  it('formats a readable summary and exposes the singleton through ATO', () => {
    FrameworkValidationReporter.reset().enable();
    FrameworkValidationReporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Started. Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
    );
    FrameworkValidationReporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] ATC_INTERNAL_TESTS: Display: DedicatedTask!',
    );
    FrameworkValidationReporter.observeProcessLine(
      'DEDICATED',
      '[8:10:31 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={ListenModeBasic.} Path={ATC.COORDINATOR_DEDICATED.ListenModeBasic.}',
    );

    const report = FrameworkValidationReporter.getReport();
    expect(ATO.FrameworkValidationReporter).toBe(FrameworkValidationReporter);
    expect(formatFrameworkValidationSummaryLines(report)).toEqual([
      'Framework Validation',
      'Tracked 1 automation test(s) with 1 captured log(s) and 0 captured event(s)',
      'DEDICATED | Success | ATC.COORDINATOR_DEDICATED.ListenModeBasic. | logs=1 | events=0',
    ]);

    FrameworkValidationReporter.reset().disable();
  });

  it('updates and compares simple-reporter snapshots with sanitized dynamic fields', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ato-snapshots-'));
    const fakeScriptPath = path.join(tempDir, 'RunStandaloneTest.ts');
    const snapshotPath = './__snapshots__/actorWorld.snapshot.json';
    const snapshotAbsolutePath = path.join(tempDir, '__snapshots__', 'actorWorld.snapshot.json');

    const reporter = new ATISimpleReporter();
    reporter.addEvent({
      version: 1,
      sessionId: 'session-1',
      sequence: -1,
      timestamp: 0,
      type: 'SessionStarted',
      coordinatorMode: 'Standalone',
    });
    reporter.addEvent({
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
      totalRuns: 1,
      repeatMode: 'None',
    });

    const validation = new FrameworkValidation(
      { enabled: true, tests: [], issues: [], totalObservedEntries: 0 },
      { simpleReporter: reporter, updateSnapshots: true, snapshotRelativeTo: fakeScriptPath },
    );

    await validation
      .getBySimpleReporterPath(['testsByEffectiveCoordinatorMode', 'Standalone', 'ATC.Sample'])
      .toMatchFileSnapshot(snapshotPath);

    const snapshot = JSON.parse(await readFile(snapshotAbsolutePath, 'utf8')) as Record<string, unknown>;
    expect(snapshot).toMatchObject({
      currentRunIndex: 1,
      testId: '<dynamic:testId>',
      testPath: 'ATC.Sample',
    });

    await new FrameworkValidation(
      { enabled: true, tests: [], issues: [], totalObservedEntries: 0 },
      { simpleReporter: reporter, updateSnapshots: false, snapshotRelativeTo: fakeScriptPath },
    )
      .getBySimpleReporterPath(['testsByEffectiveCoordinatorMode', 'Standalone', 'ATC.Sample'])
      .toMatchFileSnapshot(snapshotPath);

    await writeFile(snapshotAbsolutePath, JSON.stringify({ unexpected: true }, null, 2), 'utf8');
    await expect(
      new FrameworkValidation(
        { enabled: true, tests: [], issues: [], totalObservedEntries: 0 },
        { simpleReporter: reporter, updateSnapshots: false, snapshotRelativeTo: fakeScriptPath },
      )
        .getBySimpleReporterPath(['testsByEffectiveCoordinatorMode', 'Standalone', 'ATC.Sample'])
        .toMatchFileSnapshot(snapshotPath),
    ).rejects.toThrow('Snapshot mismatch');

    const actualPath = path.join(tempDir, '__snapshots__', 'actorWorld.snapshot.actual.json');
    const actual = JSON.parse(await readFile(actualPath, 'utf8')) as Record<string, unknown>;
    expect(actual.testId).toBe('<dynamic:testId>');

    await rm(tempDir, { recursive: true, force: true });
  });
});
