#!/usr/bin/env node
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ATO,
  Coordinator,
  CoordinatorMode,
  FrameworkValidation,
  FrameworkValidationSnapshotSubject,
} from '@maximdevoir/ato';

const assertionCaseNames = [
  'TRUE',
  'FALSE',
  'EQUAL',
  'NOT_EQUAL',
  'LT',
  'LE',
  'GT',
  'GE',
  'NEAR',
  'NULL',
  'NOT_NULL',
  'VALID',
  'ACTOR_EXISTS',
  'COMPONENT_EXISTS',
  'TAG',
  'NOT_TAG',
  'ACTOR_TAG',
  'ACTOR_NOT_TAG',
] as const;

function resolveSnapshotRelativeTo(scriptMetaUrl: string) {
  const scriptPath = fileURLToPath(scriptMetaUrl);
  const scriptDir = path.dirname(scriptPath);
  if (existsSync(path.join(scriptDir, '__snapshots__'))) {
    return scriptMetaUrl;
  }

  return pathToFileURL(
    path.resolve(scriptDir, '..', '..', 'ATO', 'packages', 'buildgraph', 'Scripts', path.basename(scriptPath)),
  );
}

function buildExpectedAssertionPaths() {
  const expectedPositivePaths = assertionCaseNames.map((name) => `ATC.ASSERTIONS.${name}_POSITIVE.`);
  const expectedNegativePaths = assertionCaseNames.map((name) => `ATC.ASSERTIONS.${name}_NEGATIVE.`);
  return {
    positive: new Set(expectedPositivePaths),
    negative: new Set(expectedNegativePaths),
    all: new Set([...expectedPositivePaths, ...expectedNegativePaths]),
  };
}

function validateAssertionTestResult(
  testPath: string,
  result: string | undefined,
  expectedPaths: ReturnType<typeof buildExpectedAssertionPaths>,
) {
  if (expectedPaths.positive.has(testPath)) {
    if (result !== 'Success') {
      throw new Error(`Expected positive assertion test '${testPath}' to succeed, but got '${result ?? 'Unknown'}'`);
    }
    expectedPaths.all.delete(testPath);
    return;
  }

  if (expectedPaths.negative.has(testPath)) {
    if (result !== 'Fail' && result !== 'Error') {
      throw new Error(`Expected negative assertion test '${testPath}' to fail, but got '${result ?? 'Unknown'}'`);
    }
    expectedPaths.all.delete(testPath);
    return;
  }

  throw new Error(`Unexpected assertion test path '${testPath}' was reported`);
}

function validateTrackedTests(
  validation: FrameworkValidation,
  expectedPaths: ReturnType<typeof buildExpectedAssertionPaths>,
) {
  const assertionTests = validation.tests.filter((test) => test.data.path.startsWith('ATC.ASSERTIONS.'));
  const markerPaths = new Set(['ZZZ.ATC.Coordinator.Standalone']);

  for (const test of validation.tests) {
    const { path: testPath, result } = test.data;
    if (testPath.startsWith('ATC.ASSERTIONS.')) {
      validateAssertionTestResult(testPath, result, expectedPaths);
      continue;
    }

    if (!markerPaths.has(testPath)) {
      throw new Error(`Unexpected non-assertion test '${testPath}' was tracked by standalone assertions validation`);
    }

    test.expectResult('Success');
  }

  return assertionTests;
}

function normalizeDynamicText(value: string) {
  return value.replaceAll(/\b[0-9A-F]{8,}\b/g, '<dynamic:pointer>');
}

function normalizeValidationLogLine(line: string) {
  return normalizeDynamicText(
    line
      .replaceAll(/^\[\d{1,2}:\d{2}:\d{2}\s(?:AM|PM)\]\s*/g, '')
      .replaceAll(/StandaloneAssertions\.test\.cpp:\d+/g, 'StandaloneAssertions.test.cpp:<line>')
      .replaceAll(/sourceFile="[^"]+"/g, 'sourceFile="<dynamic:sourceFile>"')
      .replaceAll(/sourceLine=\d+/g, 'sourceLine=<dynamic:sourceLine>')
      .replaceAll(/sourceFunction="[^"]+"/g, 'sourceFunction="<dynamic:sourceFunction>"')
      .replaceAll(/\[[A-Za-z]:[^\]]+\]/g, '[<dynamic:path>]'),
  );
}

function normalizeValidationEventFields(fields: Record<string, string>) {
  const normalizedEntries = Object.entries(fields)
    .filter(([key]) => !['sourceFile', 'sourceFunction', 'sourceLine'].includes(key))
    .map(([key, value]) => [key, normalizeDynamicText(value)]);
  return Object.fromEntries(normalizedEntries);
}

function buildAssertionSnapshot(assertionTests: ReturnType<typeof validateTrackedTests>) {
  const snapshotEntries = assertionTests
    .map((test) => test.data)
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((testRun) => [
      testRun.path,
      {
        coordinator: testRun.coordinator,
        completed: testRun.completed,
        result: testRun.result ?? 'Unknown',
        logCount: testRun.logs.length,
        eventCount: testRun.events.length,
        logs: testRun.logs.map((entry) => ({
          source: entry.source.type === 'Coordinator' ? entry.source.coordinator : `CLIENT ${entry.source.clientIndex}`,
          line: normalizeValidationLogLine(entry.line),
        })),
        events: testRun.events.map((entry) => ({
          category: entry.category,
          source: entry.source.type === 'Coordinator' ? entry.source.coordinator : `CLIENT ${entry.source.clientIndex}`,
          fields: normalizeValidationEventFields(entry.fields),
          line: normalizeValidationLogLine(entry.line),
        })),
      },
    ]);

  return Object.fromEntries(snapshotEntries);
}

async function validateStandaloneAssertionsFrameworkReport(ato: ATO) {
  const snapshotRelativeTo = resolveSnapshotRelativeTo(import.meta.url);
  const expectedAssertionCount = assertionCaseNames.length * 2;
  void ato;
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport()).assertNoIssues();

  const expectedPaths = buildExpectedAssertionPaths();
  const assertionTests = validateTrackedTests(validation, expectedPaths);

  if (assertionTests.length !== expectedAssertionCount) {
    throw new Error(`Expected ${expectedAssertionCount} assertion tests, but found ${assertionTests.length}`);
  }

  if (expectedPaths.all.size > 0) {
    throw new Error(
      `Missing assertion test coverage for: ${[...expectedPaths.all].sort((left, right) => left.localeCompare(right)).join(', ')}`,
    );
  }

  const assertionSnapshot = buildAssertionSnapshot(assertionTests);

  await new FrameworkValidationSnapshotSubject(
    assertionSnapshot,
    ato.shouldUpdateSnapshots,
    snapshotRelativeTo,
  ).toMatchFileSnapshot('./__snapshots__/RunStandaloneWithAssertions.snapshot.json');
}

const ATCStandaloneAssertionsTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const coordinator = new Coordinator(CoordinatorMode.Standalone);
coordinator.addTests('ATC.ASSERTIONS');
ATCStandaloneAssertionsTest.addCoordinator(coordinator);

await ATCStandaloneAssertionsTest.start();

const code = await (async () => {
  try {
    await validateStandaloneAssertionsFrameworkReport(ATCStandaloneAssertionsTest);
    console.log('Framework validation passed');
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
})();

process.exit(code);
