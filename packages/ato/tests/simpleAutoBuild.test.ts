import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoordinatorMode } from '../src/ATO.options';
import { SimpleAutoBuildService, type UATBuildGraphRunner, type UATBuildGraphRunOptions } from '../src/SimpleAutoBuild';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ato-autobuild-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('SimpleAutoBuildService', () => {
  it('generates a per-session buildgraph and runs UAT once with unioned requirements', async () => {
    const root = createTemporaryDirectory();
    const projectRoot = path.join(root, 'TemplateProject');
    const engineDir = path.join(root, 'UE', 'Engine');
    const projectPath = path.join(projectRoot, 'TemplateProject.uproject');
    const buildGraphRuns: UATBuildGraphRunOptions[] = [];

    fs.mkdirSync(path.join(engineDir, 'Build', 'BatchFiles'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'Saved'), { recursive: true });
    fs.writeFileSync(path.join(engineDir, 'Build', 'BatchFiles', 'RunUAT.bat'), '@echo off\n');
    fs.writeFileSync(projectPath, JSON.stringify({ EngineAssociation: 'UEI5.7.3' }));

    const runner: UATBuildGraphRunner = {
      runBuildGraph: vi.fn(async (options) => {
        buildGraphRuns.push(options);
      }),
    };
    const service = new SimpleAutoBuildService(runner);

    await service.prepare({
      engineDir,
      projectPath,
      projectRoot,
      coordinatorModes: [CoordinatorMode.Standalone, CoordinatorMode.DedicatedServer, CoordinatorMode.Standalone],
    });
    await service.prepare({
      engineDir,
      projectPath,
      projectRoot,
      coordinatorModes: [CoordinatorMode.PIE],
    });

    expect(buildGraphRuns).toHaveLength(1);
    const generatedBuildGraphPath = path.join(projectRoot, 'Saved', 'ATO', 'BuildGraph', 'build.generated.xml');
    expect(buildGraphRuns[0]?.buildGraphScriptPath).toBe(generatedBuildGraphPath);

    const generatedXml = fs.readFileSync(generatedBuildGraphPath, 'utf-8');
    expect(generatedXml).toContain('<Aggregate Name="ModeStandalone" Requires="CookGame;CompileGame"/>');
    expect(generatedXml).toContain(
      '<Aggregate Name="ModeDedicated" Requires="CookGame;CookServer;CompileGame;CompileServer"/>',
    );
    expect(generatedXml).toContain(
      '<Aggregate Name="SimpleAutoBuild" Requires="CookGame;CompileGame;CookServer;CompileServer"/>',
    );
  });
});
