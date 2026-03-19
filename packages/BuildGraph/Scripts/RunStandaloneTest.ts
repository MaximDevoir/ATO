#!/usr/bin/env node
import { ATO, FrameworkValidation, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

function validateStandaloneFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  const allowedNonSuccessPaths = new Set([
    'ATC.STANDALONE_MODE.STANDALONE_REJECTS_EXTERNAL_CLIENTS.[Clients=1]',
    'ATC.STANDALONE_MODE.FAILING_FIRST_TASK_STOPS_SEQUENTIAL_CHAIN.',
    'ATC.STANDALONE_MODE.PARALLEL_FAILURE_COMPLETES_BLOCK_BUT_STOPS_AFTER_BLOCK.',
    'ATC.STANDALONE_MODE.NON_FATAL_EXPECT_DOES_NOT_ABORT_PARALLEL_PEERS.',
  ]);

  for (const test of validation.tests) {
    const { path, result } = test.data;
    if (allowedNonSuccessPaths.has(path)) {
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
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
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
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
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
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains,
    });
  }

  validation
    .getTestByPath('ATC.STANDALONE_MODE.MAP_WORLD_OPENWORLD_RESOLVES_CURRENT_WORLD.')
    .expectResult('Success')
    .expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'CurrentWorld=/Engine/Maps/Templates/OpenWorld',
    });

  validation
    .getTestByPath('ATC.STANDALONE_MODE.MAP_WORLD_TEMPLATE_DEFAULT_RESOLVES_CURRENT_WORLD.')
    .expectResult('Success')
    .expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
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
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'SequentialFailure.FirstTaskRan',
  });
  if (sequentialFailure.logs.some((entry) => entry.line.includes('SequentialFailure.SecondTaskRan'))) {
    throw new Error('Sequential failure test unexpectedly ran the dependent task');
  }

  const parallelFailure = validation.getTestByPath(
    'ATC.STANDALONE_MODE.PARALLEL_FAILURE_COMPLETES_BLOCK_BUT_STOPS_AFTER_BLOCK.',
  );
  parallelFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ParallelFailure.FirstTaskRan',
  });
  parallelFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ParallelFailure.SecondTaskRan',
  });
  parallelFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ParallelFailure.ThirdTaskRan',
  });
  if (parallelFailure.logs.some((entry) => entry.line.includes('ParallelFailure.AfterParallelTaskRan'))) {
    throw new Error('Parallel failure test unexpectedly ran the task after the parallel block');
  }

  const nonFatalExpect = validation.getTestByPath(
    'ATC.STANDALONE_MODE.NON_FATAL_EXPECT_DOES_NOT_ABORT_PARALLEL_PEERS.',
  );
  nonFatalExpect.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'NonFatalExpect.BeforeExpect',
  });
  nonFatalExpect.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'NonFatalExpect.AfterExpect',
  });
  nonFatalExpect.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'NonFatalExpect.SecondTaskRan',
  });

  const actorWorldRepeat = validation
    .getTestByPath('ATC.STANDALONE_MODE.ACTOR_WORLD_REPEAT_RESETS_STATE.')
    .expectResult('Success');

  for (let run = 0; run < 2; run += 1) {
    actorWorldRepeat.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 2, repeatMode: 'Count' },
    });
    actorWorldRepeat.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'ActorWorldRepeat.SetupWorldFreshActor',
    });
    actorWorldRepeat.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'ActorWorldRepeat.ComponentFound',
    });
    actorWorldRepeat.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 2, repeatMode: 'Count', failed: false },
    });
  }

  actorWorldRepeat.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
    fields: { state: 'Complete', completedRuns: 2, totalRuns: 2, repeatMode: 'Count', stopReason: 'MaxRunsReached' },
  });

  {
    const reusablePlanScopeA = validation.getTestByPath('ATC.STANDALONE_SCOPED_PLANS_A.ReusableDoesntCollide.');

    reusablePlanScopeA.expectResult('Success');

    reusablePlanScopeA.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'MyPlans.ScopeA.FirstTask',
    });

    reusablePlanScopeA.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
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
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'MyPlans.ScopeB.FirstTask',
    });

    reusablePlanScopeB.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
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
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'MyPlans.OuterScope.FirstTask',
    });

    reusablePlanScopeC.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'STANDALONE',
      logContains: 'MyPlans.OuterScope.SecondTask',
    });

    if (reusablePlanScopeC.logs.some((l) => l.line.includes('ScopeA'))) {
      throw new Error('Scope C should not resolve to Scope A plan');
    }
    if (reusablePlanScopeC.logs.some((l) => l.line.includes('ScopeB'))) {
      throw new Error('Scope C should not resolve to Scope B plan');
    }
  }
}

const ATCStandaloneTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const orchestrator = new Orchestrator(OrchestratorMode.Standalone);

orchestrator.addTests('ATC.AssetAudits');
orchestrator.addTests('ATC.STANDALONE_MODE');
orchestrator.addTests('ATC.STANDALONE_SCOPED_PLANS');
ATCStandaloneTest.addOrchestrator(orchestrator);

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
