#!/usr/bin/env node
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

function validatePIEFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  const dedicatedBasicTest = validation
    .getTestByPath('ATC.COORDINATOR_DEDICATED.ListenModeBasic.')
    .expectResult('Success');
  dedicatedBasicTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'Running as Dedicated' });
  dedicatedBasicTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1 },
  });
  dedicatedBasicTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'DedicatedTask!',
  });
  dedicatedBasicTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1, success: true },
  });

  const repeatedDedicatedTest = validation
    .getTestByPath('ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL.[Clients=2]')
    .expectResult('Success');

  for (let run = 0; run < 4; run += 1) {
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 4, repeatMode: 'Count' },
    });
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_COORDINATOR_MATRIX',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'VariantStart', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1 },
    });
    repeatedDedicatedTest.expectNextLog({
      type: 'Coordinator',
      coordinator: 'PIE',
      logContains: 'InitialLogFromDedicatedCoordinator!',
    });
    repeatedDedicatedTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'LogFromOne!' });
    repeatedDedicatedTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'LogFromZero!' });
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_COORDINATOR_MATRIX',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'VariantEnd', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1, success: true },
    });
    repeatedDedicatedTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 4, repeatMode: 'Count', failed: false },
    });
  }

  repeatedDedicatedTest.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'Complete', completedRuns: 4, totalRuns: 4, repeatMode: 'Count', stopReason: 'MaxRunsReached' },
  });

  const retryAndMessagesTest = validation
    .getTestByPath('ATC.COORDINATOR_DEDICATED.RETRY_AND_MESSAGES.')
    .expectResult('Success');

  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1 },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { kind: 'NonFatalError', task: 'RecoverFromNonFatal' },
    fieldContains: { message: 'Expected false to be true' },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { task: 'RecoverFromNonFatal', state: 'Scheduled', nextAttempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { task: 'RecoverFromNonFatal', state: 'Executing', attempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'RecoveredFromNonFatal!',
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { kind: 'FatalError', task: 'RecoverFromFatal' },
    fieldContains: { message: 'RecoverFromFatal.FirstAttempt' },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { task: 'RecoverFromFatal', state: 'Scheduled', nextAttempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_TASK_RETRY',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { task: 'RecoverFromFatal', state: 'Executing', attempt: 2, retriesRemaining: 0 },
  });
  retryAndMessagesTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'RecoveredFromFatal!' });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { kind: 'Warning', task: 'EmitWarning' },
    fieldContains: { message: 'EmitWarning.WarningKind' },
  });
  retryAndMessagesTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'WarningIssued!' });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { kind: 'Skip', task: 'EmitSkip' },
    fieldContains: { message: 'EmitSkip.SkipKind' },
  });
  retryAndMessagesTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1, success: true },
  });

  const repeatUntilFailTest = validation
    .getTestByPath('ATC.COORDINATOR_DEDICATED.REPEAT_UNTIL_FAIL_TRACKING.')
    .expectResult('Success');

  for (let run = 0; run < 3; run += 1) {
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'RunStart', currentRun: run + 1, totalRuns: 3, repeatMode: 'UntilFail' },
    });
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_COORDINATOR_MATRIX',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'VariantStart', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1 },
    });
    repeatUntilFailTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'RepeatUntilFailTick!' });
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_COORDINATOR_MATRIX',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'VariantEnd', effectiveMode: 'Dedicated', currentVariant: 1, totalVariants: 1, success: true },
    });
    repeatUntilFailTest.expectNextEvent({
      category: 'ATC_EVENT_REPEAT',
      source: { type: 'Coordinator', coordinator: 'PIE' },
      fields: { state: 'RunEnd', currentRun: run + 1, totalRuns: 3, repeatMode: 'UntilFail', failed: false },
    });
  }

  repeatUntilFailTest.expectNextEvent({
    category: 'ATC_EVENT_REPEAT',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: {
      state: 'Complete',
      completedRuns: 3,
      totalRuns: 3,
      repeatMode: 'UntilFail',
      stopReason: 'MaxRunsReached',
    },
  });

  const listenOpenWorldTest = validation
    .getTestByPath('ATC.COORDINATOR_LISTEN.CLIENTS_ALL_IN_OPEN_WORLD.[Clients=2]')
    .expectResult('Success');
  listenOpenWorldTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Running as Listen Server',
  });
  listenOpenWorldTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'ListenServer', currentVariant: 1, totalVariants: 1 },
  });
  listenOpenWorldTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'ClientWorld.OpenWorld=/Engine/Maps/Templates/OpenWorld',
  });
  listenOpenWorldTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'ClientWorld.OpenWorld=/Engine/Maps/Templates/OpenWorld',
  });
  listenOpenWorldTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'ListenServer', currentVariant: 1, totalVariants: 1, success: true },
  });

  const multiModeTest = validation
    .getTestByPath('ATC.PIE_MATRIX.MULTI_MODE.RUNS_EACH_COORDINATOR.')
    .expectResult('Success');
  multiModeTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Multiple Coordinator Modes: Standalone | Listen Server',
  });
  multiModeTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'Modes', modes: 'Standalone | Listen Server', totalVariants: 2 },
  });
  multiModeTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'Running as Standalone' });
  multiModeTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'Standalone', currentVariant: 1, totalVariants: 2 },
  });
  multiModeTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.MultiMode.Standalone',
  });
  multiModeTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'Standalone', currentVariant: 1, totalVariants: 2, success: true },
  });
  multiModeTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'Running as Listen Server' });
  multiModeTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'ListenServer', currentVariant: 2, totalVariants: 2 },
  });
  multiModeTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.MultiMode.ListenServer',
  });
  multiModeTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'ListenServer', currentVariant: 2, totalVariants: 2, success: true },
  });

  const nestedIntersectionTest = validation
    .getTestByPath('ATC.PIE_MATRIX.NESTED_INTERSECTION.CHILD_MASK.LOG_EFFECTIVE_MODE.')
    .expectResult('Success');
  nestedIntersectionTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Multiple Coordinator Modes: Listen Server | Dedicated',
  });
  nestedIntersectionTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'Modes', modes: 'Listen Server | Dedicated', totalVariants: 2 },
  });
  nestedIntersectionTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Running as Listen Server',
  });
  nestedIntersectionTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'ListenServer', currentVariant: 1, totalVariants: 2 },
  });
  nestedIntersectionTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.NestedIntersection.ListenServer',
  });
  nestedIntersectionTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'ListenServer', currentVariant: 1, totalVariants: 2, success: true },
  });
  nestedIntersectionTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Running as Dedicated',
  });
  nestedIntersectionTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'Dedicated', currentVariant: 2, totalVariants: 2 },
  });
  nestedIntersectionTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.NestedIntersection.Dedicated',
  });
  nestedIntersectionTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'Dedicated', currentVariant: 2, totalVariants: 2, success: true },
  });

  const nestedOverrideTest = validation
    .getTestByPath('ATC.PIE_MATRIX.NESTED_OVERRIDE.CHILD_OVERRIDE.LOG_EFFECTIVE_MODE.')
    .expectResult('Success');
  nestedOverrideTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Multiple Coordinator Modes: Standalone | Listen Server',
  });
  nestedOverrideTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'Modes', modes: 'Standalone | Listen Server', totalVariants: 2 },
  });
  nestedOverrideTest.expectNextLog({ type: 'Coordinator', coordinator: 'PIE', logContains: 'Running as Standalone' });
  nestedOverrideTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'Standalone', currentVariant: 1, totalVariants: 2 },
  });
  nestedOverrideTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.NestedOverride.Standalone',
  });
  nestedOverrideTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'Standalone', currentVariant: 1, totalVariants: 2, success: true },
  });
  nestedOverrideTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'Running as Listen Server',
  });
  nestedOverrideTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantStart', effectiveMode: 'ListenServer', currentVariant: 2, totalVariants: 2 },
  });
  nestedOverrideTest.expectNextLog({
    type: 'Coordinator',
    coordinator: 'PIE',
    logContains: 'PIEMatrix.NestedOverride.ListenServer',
  });
  nestedOverrideTest.expectNextEvent({
    category: 'ATC_EVENT_COORDINATOR_MATRIX',
    source: { type: 'Coordinator', coordinator: 'PIE' },
    fields: { state: 'VariantEnd', effectiveMode: 'ListenServer', currentVariant: 2, totalVariants: 2, success: true },
  });
}

const ATCPIETest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();
const coordinator = new Coordinator(CoordinatorMode.PIE).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

coordinator.addTests('ATC.COORDINATOR_DEDICATED');
coordinator.addTests('ATC.COORDINATOR_LISTEN.CLIENTS_ALL_IN_OPEN_WORLD');
coordinator.addTests('ATC.PIE_MATRIX');
ATCPIETest.addCoordinator(coordinator);

let code = await ATCPIETest.start();

if (code === 0) {
  try {
    validatePIEFrameworkReport();
    console.log('Framework validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    code = 1;
  }
}

process.exit(code);
