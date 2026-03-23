import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ATO, Coordinator, CoordinatorMode, mergeCoverageReports } from '../src';

const createdDirectories: string[] = [];

async function createTempProjectRoot() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'ato-coverage-merger-'));
  createdDirectories.push(root);
  await fsp.mkdir(path.join(root, 'coverage', 'atc'), { recursive: true });
  return root;
}

async function readCoverageFile(filePath: string) {
  return fsp.readFile(filePath, 'utf8');
}

afterEach(async () => {
  for (const directoryPath of createdDirectories.splice(0)) {
    await fsp.rm(directoryPath, { recursive: true, force: true });
  }
});

describe('ATO coverage merger', () => {
  it('merges all non-merged .info files by source path and line number', async () => {
    const projectRoot = await createTempProjectRoot();
    const coverageDirectory = path.join(projectRoot, 'coverage', 'atc');

    await fsp.writeFile(
      path.join(coverageDirectory, 'merged.info'),
      ['TN:', 'SF:ATC/Private/ATC.cpp', 'DA:8,2', 'DA:11,0', 'LF:2', 'LH:1', 'end_of_record', ''].join('\n'),
      'utf8',
    );

    await fsp.writeFile(
      path.join(coverageDirectory, 'dedicated.lcov.info'),
      [
        'TN:',
        'SF:ATC/Private/ATC.cpp',
        'DA:8,1',
        'DA:11,3',
        'DA:12,0',
        'LF:3',
        'LH:2',
        'end_of_record',
        'TN:',
        'SF:ATC/Private/ATCActor.cpp',
        'DA:7,4',
        'LF:1',
        'LH:1',
        'end_of_record',
        '',
      ].join('\n'),
      'utf8',
    );

    await fsp.mkdir(path.join(coverageDirectory, 'nested'), { recursive: true });
    await fsp.writeFile(
      path.join(coverageDirectory, 'nested', 'client-0.info'),
      ['TN:', 'SF:ATC/Private/ATC.cpp', 'DA:11,5', 'DA:12,1', 'LF:2', 'LH:2', 'end_of_record', ''].join('\n'),
      'utf8',
    );

    const result = await mergeCoverageReports({ projectRoot });

    expect(result).toEqual({
      outputFilePath: path.join(coverageDirectory, 'merged.info'),
      sourceFileCount: 2,
      inputFileCount: 2,
    });

    await expect(readCoverageFile(path.join(coverageDirectory, 'merged.info'))).resolves.toBe(
      [
        'TN:',
        'SF:ATC/Private/ATC.cpp',
        'DA:8,1',
        'DA:11,8',
        'DA:12,1',
        'LF:3',
        'LH:3',
        'end_of_record',
        'TN:',
        'SF:ATC/Private/ATCActor.cpp',
        'DA:7,4',
        'LF:1',
        'LH:1',
        'end_of_record',
        '',
      ].join('\n'),
    );
  });

  it('merges coverage reports automatically at the end of a codecov ATO session', async () => {
    const projectRoot = await createTempProjectRoot();
    const projectPath = path.join(projectRoot, 'TempProject.uproject');
    const coverageDirectory = path.join(projectRoot, 'coverage', 'atc');
    await fsp.writeFile(projectPath, '{}', 'utf8');
    await fsp.writeFile(
      path.join(coverageDirectory, 'merged.info'),
      ['TN:', 'SF:ATC/Private/ATC.cpp', 'DA:8,1', 'LF:1', 'LH:1', 'end_of_record', ''].join('\n'),
      'utf8',
    );

    const ato = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath,
        projectRoot,
        verboseDebug: false,
      },
      runtimeOptions: {
        codecov: true,
      },
    });
    ato.addCoordinator(
      new Coordinator(CoordinatorMode.Standalone).configureServer({
        exe: path.join(projectRoot, 'Binaries', 'Win64', 'TempProject.exe'),
        automaticallyApplyBootstrapTestsCmds: false,
      }),
    );

    Reflect.set(ato, 'validateExecutables', () => true);
    Reflect.set(ato, 'startResolvedPlan', async () => {
      await fsp.writeFile(
        path.join(coverageDirectory, 'standalone.lcov.info'),
        ['TN:', 'SF:ATC/Private/ATC.cpp', 'DA:8,2', 'DA:10,1', 'LF:2', 'LH:2', 'end_of_record', ''].join('\n'),
        'utf8',
      );
      return 0;
    });

    await expect(ato.start()).resolves.toBe(0);

    const mergedContent = await readCoverageFile(path.join(coverageDirectory, 'merged.info'));
    expect(mergedContent).toContain('SF:ATC/Private/ATC.cpp');
    expect(mergedContent).toContain('DA:8,2');
    expect(mergedContent).toContain('DA:10,1');
    expect(mergedContent).toContain('LF:2');
    expect(mergedContent).toContain('LH:2');
    expect(fs.existsSync(path.join(coverageDirectory, 'standalone.lcov.info'))).toBe(true);
  });
});
