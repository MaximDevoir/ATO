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

async function validateDedicatedFrameworkReport(ato: ATO) {
  const simpleReporter = await loadLatestATISimpleReporterFromDirectory(
    path.join(path.dirname(ato.projectPath), 'Saved', 'Logs', 'ATI', 'Dedicated'),
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
    .toMatchFileSnapshot('./__snapshots__/RunDedicated.tests.listenModeBasic.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.MSG_FROM_ALL::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunDedicated.tests.msgFromAll.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.RETRY_AND_MESSAGES::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunDedicated.tests.retryAndMessages.snapshot.json');

  await validation
    .getBySimpleReporterPath([
      'testsByEffectiveCoordinatorMode',
      'Dedicated',
      'ATC.COORDINATOR_DEDICATED.REPEAT_UNTIL_FAIL_TRACKING::0',
    ])
    .toMatchFileSnapshot('./__snapshots__/RunDedicated.tests.repeatUntilFailTracking.snapshot.json');
}

const ATCDedicatedTest = ATO.fromCommandLine();
ATO.FrameworkValidationReporter.reset().enable();

const coordinator = new Coordinator(CoordinatorMode.DedicatedServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

coordinator.addTests('ATC.AssetAudits');
coordinator.addTests('ATC.COORDINATOR_DEDICATED');

ATCDedicatedTest.addCoordinator(coordinator);

let code = 0;
code = await ATCDedicatedTest.start();

if (code === 0) {
  try {
    await validateDedicatedFrameworkReport(ATCDedicatedTest);
    ATCDedicatedTest.output.log('Framework validation passed');
  } catch (error) {
    ATCDedicatedTest.output.error(error instanceof Error ? error.message : error);
    code = 1;
  }
}

await ATCDedicatedTest.closeOutput();
process.exit(code);
