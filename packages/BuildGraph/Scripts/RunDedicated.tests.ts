#!/usr/bin/env node
import { ATO, FrameworkValidation, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

function validateDedicatedFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  validation.getTestByPath('ATC.ORCHESTRATOR_DEDICATED.ListenModeBasic.').expectResult('Success').expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'DEDICATED',
    logContains: 'DedicatedTask!',
  });

  const repeatedDedicatedTest = validation
    .getTestByPath('ATC.ORCHESTRATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]')
    .expectResult('Success');

  for (let run = 0; run < 4; run += 1) {
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 4, repeatMode: 'Count' },
    });
    repeatedDedicatedTest.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'DEDICATED',
      logContains: 'InitialLogFromDedicatedOrchestrator!',
    });
    repeatedDedicatedTest.expectNextLog({
      type: 'Client',
      clientIndex: 1,
      logContains: 'LogFromOne!',
    });
    repeatedDedicatedTest.expectNextLog({
      type: 'Client',
      clientIndex: 0,
      logContains: 'LogFromZero!',
    });
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 4, repeatMode: 'Count', failed: false },
    });
  }

  repeatedDedicatedTest.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { state: 'Complete', completedRuns: 4, totalRuns: 4, repeatMode: 'Count', stopReason: 'MaxRunsReached' },
  });

  const retryAndMessagesTest = validation
    .getTestByPath('ATC.ORCHESTRATOR_DEDICATED.RETRY_AND_MESSAGES.')
    .expectResult('Success');

  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { kind: 'NonFatalError', task: 'RecoverFromNonFatal' },
    fieldContains: { message: 'Expected false to be true' },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { task: 'RecoverFromNonFatal', state: 'Scheduled', nextAttempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { task: 'RecoverFromNonFatal', state: 'Executing', attempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'DEDICATED',
    logContains: 'RecoveredFromNonFatal!',
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { kind: 'FatalError', task: 'RecoverFromFatal' },
    fieldContains: { message: 'RecoverFromFatal.FirstAttempt' },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { task: 'RecoverFromFatal', state: 'Scheduled', nextAttempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { task: 'RecoverFromFatal', state: 'Executing', attempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'DEDICATED',
    logContains: 'RecoveredFromFatal!',
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { kind: 'Warning', task: 'EmitWarning' },
    fieldContains: { message: 'EmitWarning.WarningKind' },
  });
  retryAndMessagesTest.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'DEDICATED',
    logContains: 'WarningIssued!',
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: { kind: 'Skip', task: 'EmitSkip' },
    fieldContains: { message: 'EmitSkip.SkipKind' },
  });

  const repeatUntilFailTest = validation
    .getTestByPath('ATC.ORCHESTRATOR_DEDICATED.REPEAT_UNTIL_FAIL_TRACKING.')
    .expectResult('Success');

  for (let run = 0; run < 3; run += 1) {
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 3, repeatMode: 'UntilFail' },
    });
    repeatUntilFailTest.expectNextLog({
      type: 'Orchestrator',
      orchestrator: 'DEDICATED',
      logContains: 'RepeatUntilFailTick!',
    });
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 3, repeatMode: 'UntilFail', failed: false },
    });
  }

  repeatUntilFailTest.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Orchestrator', orchestrator: 'DEDICATED' },
    fields: {
      state: 'Complete',
      completedRuns: 3,
      totalRuns: 3,
      repeatMode: 'UntilFail',
      stopReason: 'MaxRunsReached',
    },
  });
}

const ATCDedicatedTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

orchestrator.addTests('ATC.AssetAudits');
orchestrator.addTests('ATC.ORCHESTRATOR_DEDICATED');

ATCDedicatedTest.addOrchestrator(orchestrator);

let code = await ATCDedicatedTest.start();

if (code === 0) {
  try {
    validateDedicatedFrameworkReport();
    console.log('Framework validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    code = 1;
  }
}

process.exit(code);
