import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { CoordinatorMode } from './ATO.options';
import { normalizePathSlashes, resolveBuildGraphSchemaLocation, resolveUnrealHostPlatform } from './UnrealPlatform';

const SIMPLE_AUTO_BUILD_TARGET = 'SimpleAutoBuild';

export interface SimpleAutoBuildSessionOptions {
  engineDir: string;
  projectPath: string;
  projectRoot: string;
  coordinatorModes: CoordinatorMode[];
  log?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

export interface UATBuildGraphRunOptions {
  engineDir: string;
  projectRoot: string;
  buildGraphScriptPath: string;
  target: string;
  log?: (...args: unknown[]) => void;
}

export interface UATBuildGraphRunner {
  runBuildGraph(options: UATBuildGraphRunOptions): Promise<void>;
}

export class SimpleAutoBuildService {
  private prepared = false;

  constructor(private readonly runner: UATBuildGraphRunner = new UATRunner()) {}

  async prepare(options: SimpleAutoBuildSessionOptions) {
    if (this.prepared) {
      return;
    }

    const coordinatorModes = Array.from(new Set(options.coordinatorModes));
    if (coordinatorModes.length === 0) {
      return;
    }

    const buildGraphScriptPath = await this.writeBuildGraph(
      options.projectRoot,
      options.projectPath,
      options.engineDir,
      coordinatorModes,
    );
    options.log?.(`[ATO] SimpleAutoBuild generated ${buildGraphScriptPath}`);

    await this.runner.runBuildGraph({
      engineDir: options.engineDir,
      projectRoot: options.projectRoot,
      buildGraphScriptPath,
      target: SIMPLE_AUTO_BUILD_TARGET,
      log: options.log,
    });

    this.prepared = true;
  }

  private async writeBuildGraph(
    projectRoot: string,
    projectPath: string,
    engineDir: string,
    coordinatorModes: CoordinatorMode[],
  ) {
    const buildGraphDirectory = path.join(projectRoot, 'Saved', 'ATO', 'BuildGraph');
    await mkdir(buildGraphDirectory, { recursive: true });

    const buildGraphPath = path.join(buildGraphDirectory, 'build.generated.xml');
    const projectName = path.basename(projectPath).replace(/\.uproject$/i, '');
    const hostPlatform = resolveUnrealHostPlatform();
    const requestedRequirements = getRequestedRequirements(coordinatorModes).join(';');
    const schemaLocation = resolveBuildGraphSchemaLocation(engineDir);

    const xml = `<?xml version="1.0"?>
<BuildGraph xmlns="http://www.epicgames.com/BuildGraph"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="${schemaLocation}">
  <Option Name="ProjectFile" DefaultValue="${normalizePathSlashes(projectPath)}" Description="Path to the Unreal Engine project file"/>
  <Option Name="ProjectDir" DefaultValue="${normalizePathSlashes(projectRoot)}" Description="Directory containing the Unreal Engine project"/>
  <Option Name="ProjectName" DefaultValue="${projectName}" Description="Name of the Unreal Engine project"/>
  <Option Name="EngineDir" DefaultValue="${normalizePathSlashes(engineDir)}" Description="Directory containing the Unreal Engine installation"/>
  <Option Name="CompilePlatform" DefaultValue="${hostPlatform.compilePlatform}" Description="Compile target platform"/>
  <Option Name="CookPlatformStandalone" DefaultValue="${hostPlatform.cookPlatformStandalone}" Description="Cook platform for standalone/listen tests"/>
  <Option Name="CookPlatformDedicated" DefaultValue="${hostPlatform.cookPlatformDedicated}" Description="Cook platform for dedicated server tests"/>
  <Agent Name="Default" Type="$(CompilePlatform)">
    <Node Name="CompileEditor">
      <Compile Target="$(ProjectName)Editor"
               Platform="$(CompilePlatform)"
               Configuration="Development"
               Project="$(ProjectFile)"/>
    </Node>
    <Node Name="CompileGame">
      <Compile Target="$(ProjectName)"
               Platform="$(CompilePlatform)"
               Configuration="Development"
               Project="$(ProjectFile)"/>
    </Node>
    <Node Name="CompileServer">
      <Compile Target="$(ProjectName)Server"
               Platform="$(CompilePlatform)"
               Configuration="Development"
               Project="$(ProjectFile)"/>
    </Node>
    <Node Name="CookGame" Requires="CompileEditor">
      <Cook Project="$(ProjectFile)"
            Platform="$(CookPlatformStandalone)"
            Arguments="-iterate -unversioned"/>
    </Node>
    <Node Name="CookServer" Requires="CompileEditor">
      <Cook Project="$(ProjectFile)"
            Platform="$(CookPlatformDedicated)"
            Arguments="-iterate -unversioned"/>
    </Node>
  </Agent>
  <Aggregate Name="ModePIE" Requires="CompileEditor"/>
  <Aggregate Name="ModeStandalone" Requires="CookGame;CompileGame"/>
  <Aggregate Name="ModeDedicated" Requires="CookGame;CookServer;CompileGame;CompileServer"/>
  <Aggregate Name="ModeListen" Requires="CookGame;CompileGame"/>
  <Aggregate Name="${SIMPLE_AUTO_BUILD_TARGET}" Requires="${requestedRequirements}"/>
</BuildGraph>
`;

    await writeFile(buildGraphPath, xml, 'utf-8');
    return buildGraphPath;
  }
}

export class UATRunner implements UATBuildGraphRunner {
  async runBuildGraph(options: UATBuildGraphRunOptions) {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'dotnet' : path.join(options.engineDir, 'Build', 'BatchFiles', 'RunUAT.sh');
    const args = isWindows
      ? [path.join(options.engineDir, 'Binaries', 'DotNET', 'AutomationTool', 'AutomationTool.dll'), 'BuildGraph']
      : ['BuildGraph'];

    args.push(`-Script=${options.buildGraphScriptPath}`, `-Target=${options.target}`);
    options.log?.(`[ATO] SimpleAutoBuild invoking UAT: ${command} ${args.join(' ')}`);

    await new Promise<void>((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: options.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
      });

      childProcess.stdout?.on('data', (chunk) => {
        process.stdout.write(chunk);
      });
      childProcess.stderr?.on('data', (chunk) => {
        process.stderr.write(chunk);
      });
      childProcess.on('error', reject);
      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`[ATO] SimpleAutoBuild failed with exit code ${String(code ?? 'unknown')}`));
      });
    });
  }
}

function getRequestedRequirements(coordinatorModes: CoordinatorMode[]) {
  const requirements = new Set<string>();

  for (const coordinatorMode of coordinatorModes) {
    for (const requirement of getModeRequirements(coordinatorMode)) {
      requirements.add(requirement);
    }
  }

  return [...requirements];
}

function getModeRequirements(coordinatorMode: CoordinatorMode) {
  switch (coordinatorMode) {
    case CoordinatorMode.PIE:
      return ['CompileEditor'];
    case CoordinatorMode.DedicatedServer:
      return ['CookGame', 'CookServer', 'CompileGame', 'CompileServer'];
    case CoordinatorMode.ListenServer:
      return ['CookGame', 'CompileGame'];
    case CoordinatorMode.Standalone:
      return ['CookGame', 'CompileGame'];
    default:
      return [];
  }
}
