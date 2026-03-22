#!/usr/bin/env node
import * as path from 'node:path';
import { loadLatestATISimpleReporterFromDirectory } from '@maximdevoir/ati';
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

async function validateStandaloneFrameworkReport(ato: ATO) {
  const simpleReporter = await loadLatestATISimpleReporterFromDirectory(
    path.join(path.dirname(ato.projectPath), 'Saved', 'Logs', 'ATI', 'Standalone'),
  );
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport(), {
    simpleReporter,
    updateSnapshots: ato.shouldUpdateSnapshots,
    snapshotRelativeTo: import.meta.url,
  }).assertNoIssues();

  const expectedFails = new Set([
    'ATC.STANDALONE_MODE.STANDALONE_REJECTS_EXTERNAL_CLIENTS.[Clients=1]',
    'ATC.STANDALONE_MODE.FAILING_FIRST_TASK_STOPS_SEQUENTIAL_CHAIN.',
    'ATC.STANDALONE_MODE.PARALLEL_FAILURE_COMPLETES_BLOCK_BUT_STOPS_AFTER_BLOCK.',
    'ATC.STANDALONE_MODE.NON_FATAL_EXPECT_DOES_NOT_ABORT_PARALLEL_PEERS.',
    'ATC.EXCEPTIONS.EXPECT_ANY_THROW_REPORTS_WHEN_NOT_THROWN.',
    'ATC.EXCEPTIONS.EXPECT_ANY_THROW_SUCCEEDS.',
    'ATC.EXCEPTIONS.EXPECT_NO_THROW_REPORTS_THROWN_EXCEPTION.',
    'ATC.EXCEPTIONS.EXPECT_NO_THROW_SUCCEEDS.',
    'ATC.EXCEPTIONS.EXPECT_THROW_REPORTS_WRONG_TYPE.',
    'ATC.EXCEPTIONS.EXPECT_THROW_SUCCEEDS.',
    'ATC.RegistryRegressionConflicts.LATE_SUITE_CONFLICTS_SURFACE_AFTER_EARLY_TEST_LOCAL_CONFIG.[ConfigurationError]',
  ]);

  for (const test of validation.tests) {
    const { path, result } = test.data;
    if (expectedFails.has(path)) {
      if (result !== 'Fail' && result !== 'Error') {
        throw new Error(`Expected standalone validation test '${path}' to fail, but got '${result ?? 'Unknown'}'`);
      }
      continue;
    }

    if (result !== 'Success') {
      throw new Error(`Expected standalone test '${path}' to succeed, but got '${result ?? 'Unknown'}'`);
    }
  }

  validation.getTestByPath('ATC.STANDALONE_MODE.STANDALONE_TEST.').expectResult('Success').expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'StandaloneTask!',
  });

  const matrixExpectations = [
    ['ATC.STANDALONE_MODE.MATRIX_EXPANDS_AND_BINDS.[Lhs=2,Rhs=3]', 'MatrixInvocation Lhs=2 Rhs=3 Product=6'],
    ['ATC.STANDALONE_MODE.MATRIX_EXPANDS_AND_BINDS.[Lhs=2,Rhs=5]', 'MatrixInvocation Lhs=2 Rhs=5 Product=10'],
    ['ATC.STANDALONE_MODE.MATRIX_EXPANDS_AND_BINDS.[Lhs=4,Rhs=3]', 'MatrixInvocation Lhs=4 Rhs=3 Product=12'],
    ['ATC.STANDALONE_MODE.MATRIX_EXPANDS_AND_BINDS.[Lhs=4,Rhs=5]', 'MatrixInvocation Lhs=4 Rhs=5 Product=20'],
  ] as const;

  for (const [path, logContains] of matrixExpectations) {
    validation.getTestByPath(path).expectResult('Success').expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains,
    });
  }

  const paramTableExpectations = [
    [
      'ATC.STANDALONE_MODE.PARAM_TABLE_BINDS_ROWS.[RowName=Alpha,Left=1,Right=2,ExpectedSum=3]',
      'ParamTableInvocation Row=Alpha Sum=3',
    ],
    [
      'ATC.STANDALONE_MODE.PARAM_TABLE_BINDS_ROWS.[RowName=Beta,Left=5,Right=8,ExpectedSum=13]',
      'ParamTableInvocation Row=Beta Sum=13',
    ],
  ] as const;

  for (const [path, logContains] of paramTableExpectations) {
    validation.getTestByPath(path).expectResult('Success').expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains,
    });
  }

  validation
    .getTestByPath('ATC.STANDALONE_MODE.MAP_WORLD_OPENWORLD_RESOLVES_CURRENT_WORLD.')
    .expectResult('Success')
    .expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'CurrentWorld=/Engine/Maps/Templates/OpenWorld',
    });

  validation
    .getTestByPath('ATC.STANDALONE_MODE.MAP_WORLD_TEMPLATE_DEFAULT_RESOLVES_CURRENT_WORLD.')
    .expectResult('Success')
    .expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'CurrentWorld=/Engine/Maps/Templates/Template_Default',
    });

  validation
    .getTestByPath('RegistryRegressionDefaults.LATE_SUITE_DEFAULTS_APPLY_AFTER_EARLY_TEST_LOCAL_CONFIG.')
    .expectResult('Success')
    .expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'LateSuiteDefaults.CurrentWorld=/Engine/Maps/Templates/Template_Default',
    });

  validation
    .getTestByPath(
      'ATC.RegistryRegressionConflicts.LATE_SUITE_CONFLICTS_SURFACE_AFTER_EARLY_TEST_LOCAL_CONFIG.[ConfigurationError]',
    )
    .expectResult('Fail');

  const standaloneClients = validation.getTestByPath(
    'ATC.STANDALONE_MODE.STANDALONE_REJECTS_EXTERNAL_CLIENTS.[Clients=1]',
  );
  if (standaloneClients.logs.some((entry) => entry.line.includes('StandaloneClients.ShouldNeverRun'))) {
    throw new Error('Standalone external-client rejection test unexpectedly executed its task body');
  }

  const sequentialFailure = validation.getTestByPath('ATC.STANDALONE_MODE.FAILING_FIRST_TASK_STOPS_SEQUENTIAL_CHAIN.');
  sequentialFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'SequentialFailure.FirstTaskRan',
  });
  if (sequentialFailure.logs.some((entry) => entry.line.includes('SequentialFailure.SecondTaskRan'))) {
    throw new Error('Sequential failure test unexpectedly ran the dependent task');
  }

  const parallelFailure = validation.getTestByPath(
    'ATC.STANDALONE_MODE.PARALLEL_FAILURE_COMPLETES_BLOCK_BUT_STOPS_AFTER_BLOCK.',
  );
  parallelFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ParallelFailure.FirstTaskRan',
  });
  parallelFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ParallelFailure.SecondTaskRan',
  });
  parallelFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ParallelFailure.ThirdTaskRan',
  });
  if (parallelFailure.logs.some((entry) => entry.line.includes('ParallelFailure.AfterParallelTaskRan'))) {
    throw new Error('Parallel failure test unexpectedly ran the task after the parallel block');
  }

  const nonFatalExpect = validation.getTestByPath(
    'ATC.STANDALONE_MODE.NON_FATAL_EXPECT_DOES_NOT_ABORT_PARALLEL_PEERS.',
  );
  nonFatalExpect.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'NonFatalExpect.BeforeExpect',
  });
  nonFatalExpect.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'NonFatalExpect.AfterExpect',
  });
  nonFatalExpect.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'NonFatalExpect.SecondTaskRan',
  });

  const _actorWorldRepeat = validation
    .getTestByPath('ATC.STANDALONE_MODE.ACTOR_WORLD_REPEAT_RESETS_STATE.')
    .expectResult('Success');
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.STANDALONE_MODE.ACTOR_WORLD_REPEAT_RESETS_STATE::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.actorWorldRepeat.snapshot.json');

  const skipTask = validation
    .getTestByPath('ATC.ATC_SKIP_TESTS.TASK_SKIP_ONLY_SKIPS_CURRENT_TASK.')
    .expectResult('Success');
  skipTask.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipTask.Before' });
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.ATC_SKIP_TESTS.TASK_SKIP_ONLY_SKIPS_CURRENT_TASK::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.skipTask.snapshot.json');
  skipTask.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipTask.NextTaskRan' });
  if (skipTask.logs.some((entry) => entry.line.includes('SkipTask.After'))) {
    throw new Error('ATC_SKIP_TASK unexpectedly continued executing the current task body');
  }

  const skipTest = validation.getTestByPath('ATC.ATC_SKIP_TESTS.TEST_SKIP_STOPS_CURRENT_RUN.').expectResult('Success');
  skipTest.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipTest.Before' });
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.ATC_SKIP_TESTS.TEST_SKIP_STOPS_CURRENT_RUN::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.skipStopsCurrentRun.snapshot.json');
  if (skipTest.logs.some((entry) => entry.line.includes('SkipTest.AfterTaskRan'))) {
    throw new Error('ATC_SKIP unexpectedly allowed later tasks in the run to execute');
  }
  if (skipTest.logs.some((entry) => entry.line.includes('SkipTest.After'))) {
    throw new Error('ATC_SKIP unexpectedly continued executing the current task body');
  }

  const skipTaskRetry = validation
    .getTestByPath('ATC.ATC_SKIP_TESTS.SKIP_TASK_DOES_NOT_TRIGGER_RETRY.')
    .expectResult('Success');
  skipTaskRetry.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipTaskRetry.Before' });
  skipTaskRetry.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'SkipTaskRetry.NextTaskRan',
  });
  if (
    skipTaskRetry.events.some(
      (entry) => entry.category === 'ATC_EVENT_TASK_RETRY' && entry.fields.task === 'SkipTaskWithRetryConfigured',
    )
  ) {
    throw new Error('ATC_SKIP_TASK unexpectedly triggered task retry handling');
  }

  const _skipManyZero = validation.getTestByPath('ATC.ATC_SKIP_TESTS.SKIP_MANY_ZERO_IS_NOOP.').expectResult('Success');
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.ATC_SKIP_TESTS.SKIP_MANY_ZERO_IS_NOOP::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.skipManyZero.snapshot.json');

  const skipMany = validation
    .getTestByPath('ATC.ATC_SKIP_TESTS.TEST_SKIP_MANY_ADVANCES_REPEAT.')
    .expectResult('Success');
  skipMany.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipMany.Execution=1' });
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.ATC_SKIP_TESTS.TEST_SKIP_MANY_ADVANCES_REPEAT::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.skipMany.snapshot.json');
  if (skipMany.logs.some((entry) => entry.line.includes('SkipMany.Continued.Execution=1'))) {
    throw new Error('ATC_SKIP_MANY unexpectedly continued executing the current run after requesting a skip');
  }
  if (skipMany.logs.some((entry) => entry.line.includes('SkipMany.TailTask.Execution=1'))) {
    throw new Error('ATC_SKIP_MANY unexpectedly allowed later tasks in the skipped run to execute');
  }

  const skipAll = validation
    .getTestByPath('ATC.ATC_SKIP_TESTS.TEST_SKIP_ALL_STOPS_ALL_REPEATS.')
    .expectResult('Success');
  skipAll.expectNextLog({ type: 'Coordinator', coordinator: 'STANDALONE', logContains: 'SkipAll.Execution=1' });
  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.ATC_SKIP_TESTS.TEST_SKIP_ALL_STOPS_ALL_REPEATS::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunStandaloneTest.skipAll.snapshot.json');
  if (skipAll.logs.some((entry) => entry.line.includes('SkipAll.TailTaskRan'))) {
    throw new Error('ATC_SKIP_ALL unexpectedly allowed later tasks in the skipped run to execute');
  }

  {
    const reusablePlanScopeA = validation.getTestByPath('ATC.STANDALONE_SCOPED_PLANS_A.ReusableDoesntCollide.');

    reusablePlanScopeA.expectResult('Success');

    reusablePlanScopeA.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.ScopeA.FirstTask',
    });

    reusablePlanScopeA.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.ScopeA.SecondTask',
    });
    if (reusablePlanScopeA.logs.some((l) => l.line.includes('ScopeB'))) {
      throw new Error('Scope A test incorrectly used Scope B plan');
    }
    if (reusablePlanScopeA.logs.some((l) => l.line.includes('OuterScope'))) {
      throw new Error('Scope A test incorrectly used global plan');
    }
  }
  {
    const reusablePlanScopeB = validation.getTestByPath('ATC.STANDALONE_SCOPED_PLANS_B.ReusableDoesntCollide.');

    reusablePlanScopeB.expectResult('Success');

    reusablePlanScopeB.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.ScopeB.FirstTask',
    });

    reusablePlanScopeB.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.ScopeB.SecondTask',
    });

    if (reusablePlanScopeB.logs.some((l) => l.line.includes('ScopeA'))) {
      throw new Error('Scope B test incorrectly used Scope A plan');
    }
    if (reusablePlanScopeB.logs.some((l) => l.line.includes('OuterScope'))) {
      throw new Error('Scope B test incorrectly used global plan');
    }
  }
  {
    const reusablePlanScopeC = validation.getTestByPath('ATC.STANDALONE_SCOPED_PLANS_C.ReusableDoesntCollide.');

    reusablePlanScopeC.expectResult('Success');

    reusablePlanScopeC.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.OuterScope.FirstTask',
    });

    reusablePlanScopeC.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'MyPlans.OuterScope.SecondTask',
    });

    if (reusablePlanScopeC.logs.some((l) => l.line.includes('ScopeA'))) {
      throw new Error('Scope C should not resolve to Scope A plan');
    }
    if (reusablePlanScopeC.logs.some((l) => l.line.includes('ScopeB'))) {
      throw new Error('Scope C should not resolve to Scope B plan');
    }
  }
  {
    const ExpectExceptionUnsupportedMessageInTests = [
      'ATC.EXCEPTIONS.EXPECT_ANY_THROW_REPORTS_WHEN_NOT_THROWN.',
      'ATC.EXCEPTIONS.EXPECT_ANY_THROW_SUCCEEDS.',
      'ATC.EXCEPTIONS.EXPECT_NO_THROW_REPORTS_THROWN_EXCEPTION.',
      'ATC.EXCEPTIONS.EXPECT_NO_THROW_SUCCEEDS.',
      'ATC.EXCEPTIONS.EXPECT_THROW_REPORTS_WRONG_TYPE.',
      'ATC.EXCEPTIONS.EXPECT_THROW_SUCCEEDS.',
    ];
    for (const testPath of ExpectExceptionUnsupportedMessageInTests) {
      const exceptionValidation = validation.getTestByPath(testPath);
      exceptionValidation.expectResult('Fail');
      exceptionValidation.expectNextLog({
        type: 'Coordinator',
        logContains: 'C++ exceptions are disabled',
      });
    }
  }
}

const ATCStandaloneTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const coordinator = new Coordinator(CoordinatorMode.Standalone);
coordinator.configureServer({
  extraArgs: ['-LogCommand=global VeryVerbose'],
  excludeArgs: ['-Verbose'],
});
coordinator.addTests('ATC.AssetAudits');
coordinator.addTests('ATC.STANDALONE_MODE');
coordinator.addTests('ATC.ATC_SKIP_TESTS');
coordinator.addTests('ATC.STANDALONE_SCOPED_PLANS');
coordinator.addTests('ATC.EXCEPTIONS');
coordinator.addTests('RegistryRegressionDefaults');
coordinator.addTests('ATC.RegistryRegressionConflicts');

ATCStandaloneTest.addCoordinator(coordinator);

let code = 0;
code = await ATCStandaloneTest.start();

try {
  await validateStandaloneFrameworkReport(ATCStandaloneTest);
  console.log('Framework validation passed');
  code = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  code = 1;
}

process.exit(code);
