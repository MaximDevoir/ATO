#!/usr/bin/env node
import { ATO, FrameworkValidation, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

function validateStandaloneWithExceptionsFrameworkReport() {
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  const expectedFails = new Set([
    'ATC.EXCEPTIONS.EXPECT_ANY_THROW_REPORTS_WHEN_NOT_THROWN.',
    'ATC.EXCEPTIONS.EXPECT_THROW_REPORTS_WRONG_TYPE.',
    'ATC.EXCEPTIONS.EXPECT_NO_THROW_REPORTS_THROWN_EXCEPTION.',
  ]);

  for (const test of validation.tests) {
    const { path, result } = test.data;
    if (expectedFails.has(path)) {
      if (result !== 'Fail' && result !== 'Error') {
        throw new Error(
          `Expected standalone-with-exceptions validation test '${path}' to fail, but got '${result ?? 'Unknown'}'`,
        );
      }
      continue;
    }

    if (result !== 'Success') {
      throw new Error(
        `Expected standalone-with-exceptions test '${path}' to succeed, but got '${result ?? 'Unknown'}'`,
      );
    }
  }

  validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_ANY_THROW_SUCCEEDS.').expectResult('Success').expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Success.AfterExpect',
  });

  const expectAnyThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_ANY_THROW_REPORTS_WHEN_NOT_THROWN.');
  expectAnyThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Failure.BeforeExpect',
  });
  expectAnyThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to throw an exception, but it did not throw' },
  });
  expectAnyThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Failure.AfterExpect',
  });

  validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_THROW_SUCCEEDS.').expectResult('Success').expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectThrow.Success.AfterExpect',
  });

  const expectThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_THROW_REPORTS_WRONG_TYPE.');
  expectThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectThrow.Failure.BeforeExpect',
  });
  expectThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to throw FString, but it threw an int32 exception: 7' },
  });
  expectThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectThrow.Failure.AfterExpect',
  });

  validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_NO_THROW_SUCCEEDS.').expectResult('Success').expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Success.AfterExpect',
  });

  const expectNoThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_NO_THROW_REPORTS_THROWN_EXCEPTION.');
  expectNoThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Failure.BeforeExpect',
  });
  expectNoThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Orchestrator', orchestrator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to not throw, but it threw an FString exception: "NoThrowFailure"' },
  });
  expectNoThrowFailure.expectNextLog({
    type: 'Orchestrator',
    orchestrator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Failure.AfterExpect',
  });
}

const ATCStandaloneWithExceptionsTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const orchestrator = new Orchestrator(OrchestratorMode.Standalone);
orchestrator.addTests('ATC.EXCEPTIONS');
ATCStandaloneWithExceptionsTest.addOrchestrator(orchestrator);

let code = await ATCStandaloneWithExceptionsTest.start();

try {
  validateStandaloneWithExceptionsFrameworkReport();
  console.log('Framework validation passed');
  code = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  code = 1;
}

process.exit(code);
