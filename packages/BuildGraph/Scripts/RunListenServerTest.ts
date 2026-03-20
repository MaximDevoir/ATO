#!/usr/bin/env node
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

function validateListenFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  for (const test of validation.tests) {
    test.expectResult('Success');
  }

  validation.getTestByPath('ATC.COORDINATOR_LISTEN.ListenModeBasic.').expectResult('Success').expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ListenTask!',
  });

  validation.getTestByPath('ATC.COORDINATOR_LISTEN.MSG_FROM_ALL.[Clients=2]').expectResult('Success').expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'InitialLogFromListenCoordinator!',
  });

  validation.getTestByPath('ATC.COORDINATOR_LISTEN.MSG_FROM_ALL.[Clients=2]').expectNextLog({
    type: 'Client',
    clientIndex: 1,
    logContains: 'LogFromOne!',
  });

  validation.getTestByPath('ATC.COORDINATOR_LISTEN.MSG_FROM_ALL.[Clients=2]').expectNextLog({
    type: 'Client',
    clientIndex: 0,
    logContains: 'LogFromZero!',
  });

  const parallelDeps = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.PARALLEL_EXPLICIT_DEPS_RESPECT_ORDER.[Clients=2]')
    .expectResult('Success');
  parallelDeps.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ParallelDeps.IndependentCoordinator',
  });
  parallelDeps.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ParallelDeps.DependentCoordinator',
  });
  parallelDeps.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ParallelDeps.AfterParallel',
  });
  if (
    !parallelDeps.logs.some(
      (entry) =>
        entry.source.type === 'Client' &&
        entry.source.clientIndex === 0 &&
        entry.line.includes('ParallelDeps.Client0Waiting'),
    )
  ) {
    throw new Error('Parallel listen test did not capture the client 0 wait log');
  }
  if (
    !parallelDeps.logs.some(
      (entry) =>
        entry.source.type === 'Client' &&
        entry.source.clientIndex === 1 &&
        entry.line.includes('ParallelDeps.Client1Done'),
    )
  ) {
    throw new Error('Parallel listen test did not capture the client 1 completion log');
  }

  const reusedPlan = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.PLAN_REUSE.RUN_PLAN_TWICE_WITH_INLINE_TASK.')
    .expectResult('Success');
  reusedPlan.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'PlanReuse.SharedPlanTask',
  });
  reusedPlan.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'PlanReuse.BetweenRuns',
  });
  reusedPlan.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'PlanReuse.SharedPlanTask',
  });

  validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.CLIENTS_ALL_IN_TEMPLATE_DEFAULT_WORLD.[Clients=2]')
    .expectResult('Success')
    .expectNextParallelLogs([
      {
        type: 'Client',
        clientIndex: 0,
        logContains: 'ClientWorld.TemplateDefault=/Engine/Maps/Templates/Template_Default',
      },
      {
        type: 'Client',
        clientIndex: 1,
        logContains: 'ClientWorld.TemplateDefault=/Engine/Maps/Templates/Template_Default',
      },
    ]);

  validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.CLIENTS_ALL_IN_OPEN_WORLD.[Clients=2]')
    .expectResult('Success')
    .expectNextParallelLogs([
      { type: 'Client', clientIndex: 0, logContains: 'ClientWorld.OpenWorld=/Engine/Maps/Templates/OpenWorld' },
      { type: 'Client', clientIndex: 1, logContains: 'ClientWorld.OpenWorld=/Engine/Maps/Templates/OpenWorld' },
    ]);

  const waitFrames = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.WAIT_FRAMES_ON_CLIENT_THEN_LISTEN_SERVER.[Clients=1]')
    .expectResult('Success');
  waitFrames.expectNextLog({ type: 'Client', clientIndex: 0, logContains: 'WaitFrames.ClientBefore' });
  waitFrames.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'WaitFrames.ListenServerStart',
  });
  waitFrames.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'WaitFrames.LocalPlayerAfter',
  });

  const waitUntil = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.WAIT_UNTIL_ON_LISTEN_SERVER_THEN_CLIENT.[Clients=1]')
    .expectResult('Success');
  waitUntil.expectNextLog({ type: 'Client', clientIndex: 0, logContains: 'WaitUntil.ClientBefore' });
  waitUntil.expectNextLog({ type: 'Coordinator', coordinator: 'LISTEN', logContains: 'WaitUntil.ListenServerStart' });
  waitUntil.expectNextLog({ type: 'Coordinator', coordinator: 'LISTEN', logContains: 'WaitUntil.LocalPlayerAfter' });

  const localPlayer = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.LOCAL_PLAYER_TASK_SHARES_LISTEN_PROCESS.[Clients=1]')
    .expectResult('Success');
  localPlayer.expectNextLog({ type: 'Client', clientIndex: 0, logContains: 'LocalPlayer.ClientZeroFirst' });
  localPlayer.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'LocalPlayer.LocalPlayerTask',
  });
  localPlayer.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'LocalPlayer.CoordinatorAfter',
  });

  const actorWorld = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.LISTEN_ACTOR_WORLD_WORKS.')
    .expectResult('Success');
  actorWorld.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ListenActorWorld.SetupWorldFreshActor',
  });
  actorWorld.expectNextLog({
    type: 'Coordinator',
    coordinator: 'LISTEN',
    logContains: 'ListenActorWorld.ComponentFound',
  });
}

let exitCode = 0;
const ATCListenServerTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const coordinator = new Coordinator(CoordinatorMode.ListenServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

// coordinator.addTests('ATC.AssetAudits');
// coordinator.addTests('ATC.COORDINATOR_LISTEN');
// coordinator.addTests('ATC.STANDALONE_MODE.ACTOR_WORLD_REPEAT_RESETS_STATE.');
coordinator.addTests('ATC.COORDINATOR_LISTEN.LISTEN_ACTOR_WORLD_WORKS.');
ATCListenServerTest.addCoordinator(coordinator);

exitCode = await ATCListenServerTest.start();

if (exitCode === 0) {
  try {
    validateListenFrameworkReport();
    console.log('Framework validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = 1;
  }
}

process.exit(exitCode);
