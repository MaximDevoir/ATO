#!/usr/bin/env node
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLatestATISimpleReporterFromDirectory } from '@maximdevoir/ati';
import { ATO, Coordinator, CoordinatorMode, FrameworkValidation } from '@maximdevoir/ato';

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

async function validatePIEFrameworkReport(ato: ATO) {
  const simpleReporter = await loadLatestATISimpleReporterFromDirectory(
    path.join(path.dirname(ato.projectPath), 'Saved', 'Logs', 'ATI', 'PIE'),
  );
  const validation = new FrameworkValidation(ATO.FrameworkValidationReporter.getReport(), {
    simpleReporter,
    updateSnapshots: ato.shouldUpdateSnapshots,
    snapshotRelativeTo: resolveSnapshotRelativeTo(import.meta.url),
  }).assertNoIssues();

  for (const test of validation.tests) {
    test.expectResult('Success');
  }

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.ListenModeBasic::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.listenModeBasic.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.msgFromAll.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.RETRY_AND_MESSAGES::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.retryAndMessages.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.REPEAT_UNTIL_FAIL_TRACKING::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.repeatUntilFailTracking.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'ListenServer',
      'ATC.COORDINATOR_LISTEN.CLIENTS_ALL_IN_OPEN_WORLD::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.listenClientsAllInOpenWorld.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.PIE_MATRIX.MULTI_MODE.RUNS_EACH_COORDINATOR::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.multiMode.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.PIE_MATRIX.NESTED_INTERSECTION.CHILD_MASK.LOG_EFFECTIVE_MODE::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.nestedIntersection.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Standalone',
      'ATC.PIE_MATRIX.NESTED_OVERRIDE.CHILD_OVERRIDE.LOG_EFFECTIVE_MODE::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunPIETest.nestedOverride.snapshot.json');
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

let code = 0;
code = await ATCPIETest.start();

if (code === 0) {
  try {
    await validatePIEFrameworkReport(ATCPIETest);
    ATCPIETest.output.log('Framework validation passed');
  } catch (error) {
    ATCPIETest.output.error(error instanceof Error ? error.message : error);
    code = 1;
  }
}

await ATCPIETest.closeOutput();
process.exit(code);
