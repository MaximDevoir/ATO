#!/usr/bin/env node
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

function validateStandaloneFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

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

  const actorWorldRepeat = validation
    .getTestByPath('ATC.STANDALONE_MODE.ACTOR_WORLD_REPEAT_RESETS_STATE.')
    .expectResult('Success');

  for (let run = 0; run < 2; run += 1) {
    actorWorldRepeat.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'STANDALONE' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 2, repeatMode: 'Count' },
    });
    actorWorldRepeat.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'ActorWorldRepeat.SetupWorldFreshActor',
    });
    actorWorldRepeat.expectNextLog({
      type: 'Coordinator',
      coordinator: 'STANDALONE',
      logContains: 'ActorWorldRepeat.ComponentFound',
    });
    actorWorldRepeat.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'STANDALONE' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 2, repeatMode: 'Count', failed: false },
    });
  }

  actorWorldRepeat.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Coordinator', coordinator: 'STANDALONE' },
    fields: { state: 'Complete', completedRuns: 2, totalRuns: 2, repeatMode: 'Count', stopReason: 'MaxRunsReached' },
  });

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

coordinator.addTests('ATC.AssetAudits');
coordinator.addTests('ATC.STANDALONE_MODE');
coordinator.addTests('ATC.STANDALONE_SCOPED_PLANS');
coordinator.addTests('ATC.EXCEPTIONS');

ATCStandaloneTest.addCoordinator(coordinator);

let code = await ATCStandaloneTest.start();

try {
  validateStandaloneFrameworkReport();
  console.log('Framework validation passed');
  code = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  code = 1;
}

process.exit(code);
