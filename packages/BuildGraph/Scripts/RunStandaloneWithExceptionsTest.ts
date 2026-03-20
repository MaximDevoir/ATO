#!/usr/bin/env node
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

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
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Success.AfterExpect',
  });

  const expectAnyThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_ANY_THROW_REPORTS_WHEN_NOT_THROWN.');
  expectAnyThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Failure.BeforeExpect',
  });
  expectAnyThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to throw an exception, but it did not throw' },
  });
  expectAnyThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectAnyThrow.Failure.AfterExpect',
  });

  validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_THROW_SUCCEEDS.').expectResult('Success').expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectThrow.Success.AfterExpect',
  });

  const expectThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_THROW_REPORTS_WRONG_TYPE.');
  expectThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectThrow.Failure.BeforeExpect',
  });
  expectThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to throw FString, but it threw an int32 exception: 7' },
  });
  expectThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectThrow.Failure.AfterExpect',
  });

  validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_NO_THROW_SUCCEEDS.').expectResult('Success').expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Success.AfterExpect',
  });

  const expectNoThrowFailure = validation.getTestByPath('ATC.EXCEPTIONS.EXPECT_NO_THROW_REPORTS_THROWN_EXCEPTION.');
  expectNoThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Failure.BeforeExpect',
  });
  expectNoThrowFailure.expectNextEvent({
    category: 'ATC_EVENT_MESSAGE',
    source: { type: 'Coordinator', coordinator: 'STANDALONE' },
    fields: { kind: 'NonFatalError' },
    fieldContains: { message: 'to not throw, but it threw an FString exception: "NoThrowFailure"' },
  });
  expectNoThrowFailure.expectNextLog({
    type: 'Coordinator',
    coordinator: 'STANDALONE',
    logContains: 'ExpectNoThrow.Failure.AfterExpect',
  });
}

const ATCStandaloneWithExceptionsTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const testCoordinator = new Coordinator(CoordinatorMode.Standalone);
testCoordinator.addTests('ATC.EXCEPTIONS');
ATCStandaloneWithExceptionsTest.addCoordinator(testCoordinator);

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
