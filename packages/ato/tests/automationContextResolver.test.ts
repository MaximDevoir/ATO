import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AutomationContextResolver } from '../src/AutomationContextResolver';
import { EngineAssociationResolver } from '../src/EngineAssociationResolver';
import { ProjectResolver } from '../src/ProjectResolver';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ato-context-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createValidEngineDirectory(engineDir: string) {
  fs.mkdirSync(path.join(engineDir, 'Build', 'BatchFiles'), { recursive: true });
  fs.writeFileSync(path.join(engineDir, 'Build', 'BatchFiles', 'RunUAT.bat'), '@echo off\n');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('AutomationContextResolver', () => {
  it('resolves project and engine directory from a script-relative .env file', () => {
    const root = createTemporaryDirectory();
    const projectRoot = path.join(root, 'TemplateProject');
    const scriptDirectory = path.join(projectRoot, 'buildgraph', 'Scripts');
    const engineDir = path.join(root, 'UE', 'Engine');

    fs.mkdirSync(scriptDirectory, { recursive: true });
    createValidEngineDirectory(engineDir);
    fs.writeFileSync(path.join(projectRoot, '.env'), `ENGINE_DIR=${engineDir}\n`);
    fs.writeFileSync(
      path.join(projectRoot, 'TemplateProject.uproject'),
      JSON.stringify({ EngineAssociation: 'UEI5.7.3' }),
    );

    const context = new AutomationContextResolver().resolve({
      rawArgv: ['node', path.join(scriptDirectory, 'RunStandaloneTest.ts')],
      cwd: projectRoot,
      env: {},
    });

    expect(context.projectPath).toBe(path.join(projectRoot, 'TemplateProject.uproject'));
    expect(context.projectRoot).toBe(projectRoot);
    expect(context.ueRoot).toBe(engineDir);
  });

  it('falls back to EngineAssociation when ENGINE_DIR is missing or invalid', () => {
    const root = createTemporaryDirectory();
    const projectRoot = path.join(root, 'TemplateProject');
    const scriptDirectory = path.join(projectRoot, 'buildgraph', 'Scripts');
    const installedRoot = path.join(root, 'InstalledBuild');
    const installedEngineDir = path.join(installedRoot, 'Engine');

    fs.mkdirSync(scriptDirectory, { recursive: true });
    createValidEngineDirectory(installedEngineDir);
    fs.writeFileSync(path.join(projectRoot, '.env'), 'ENGINE_DIR=Z:/missing/Engine\n');
    fs.writeFileSync(
      path.join(projectRoot, 'TemplateProject.uproject'),
      JSON.stringify({ EngineAssociation: 'UEI5.7.3' }),
    );

    const engineAssociationResolver = new EngineAssociationResolver({
      platform: 'win32',
      queryWindowsRegistryValue: () => installedRoot,
    });
    const context = new AutomationContextResolver({
      projectResolver: new ProjectResolver(),
      engineAssociationResolver,
    }).resolve({
      rawArgv: ['node', path.join(scriptDirectory, 'RunStandaloneTest.ts')],
      cwd: projectRoot,
      env: {},
    });

    expect(context.ueRoot).toBe(installedEngineDir);
    expect(context.projectPath).toBe(path.join(projectRoot, 'TemplateProject.uproject'));
  });
});
