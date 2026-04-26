import fs from 'node:fs';
import * as path from 'node:path';
import { EngineAssociationResolver, isValidEngineDirectory } from '@maximdevoir/engine-association-resolver';
import dotenv from 'dotenv';
import type { E2ECommandLineContext } from './ATO.options.js';
import { ProjectResolver } from './ProjectResolver.js';

export interface AutomationContextResolutionOptions {
  explicitProjectPath?: string;
  explicitEngineDir?: string;
  rawArgv?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  verboseDebug?: boolean;
}

export interface AutomationContextResolverDependencies {
  projectResolver?: ProjectResolver;
  engineAssociationResolver?: EngineAssociationResolver;
}

export class AutomationContextResolver {
  private readonly projectResolver: ProjectResolver;
  private readonly engineAssociationResolver: EngineAssociationResolver;

  constructor(dependencies: AutomationContextResolverDependencies = {}) {
    this.projectResolver = dependencies.projectResolver ?? new ProjectResolver();
    this.engineAssociationResolver = dependencies.engineAssociationResolver ?? new EngineAssociationResolver();
  }

  resolve(options: AutomationContextResolutionOptions = {}): E2ECommandLineContext {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const entryDirectory = resolveEntryDirectory(options.rawArgv, cwd);
    const project = this.projectResolver.resolve({
      explicitProjectPath: options.explicitProjectPath,
      entryDirectory,
      cwd,
    });

    const engineDir = this.resolveEngineDirectory({
      explicitEngineDir: options.explicitEngineDir,
      entryDirectory,
      projectPath: project.projectPath,
      projectRoot: project.projectRoot,
      env: options.env ?? process.env,
      cwd,
    });

    return {
      ueRoot: engineDir,
      projectPath: project.projectPath,
      projectRoot: project.projectRoot,
      verboseDebug: options.verboseDebug ?? false,
    };
  }

  private resolveEngineDirectory(options: {
    explicitEngineDir?: string;
    entryDirectory: string;
    projectPath: string;
    projectRoot: string;
    env: NodeJS.ProcessEnv;
    cwd: string;
  }) {
    const explicitEngineDir = options.explicitEngineDir?.trim();
    if (explicitEngineDir) {
      const resolvedExplicitEngineDir = path.resolve(options.cwd, explicitEngineDir);
      if (!isValidEngineDirectory(resolvedExplicitEngineDir)) {
        throw new Error(
          `[ATO] UERoot was provided but is not a valid Unreal Engine directory: ${resolvedExplicitEngineDir}`,
        );
      }

      return resolvedExplicitEngineDir;
    }

    const dotEnvPath = this.projectResolver.findNearestFileUpwards(options.entryDirectory, '.env');
    const parsedDotEnv = dotEnvPath ? parseDotEnvFile(dotEnvPath) : undefined;
    const envEngineDirCandidate = parsedDotEnv?.ENGINE_DIR?.trim() || options.env.ENGINE_DIR?.trim();

    if (envEngineDirCandidate) {
      const resolvedEngineDir = path.resolve(options.projectRoot, envEngineDirCandidate);
      if (isValidEngineDirectory(resolvedEngineDir)) {
        return resolvedEngineDir;
      }
    }

    const engineAssociation = readEngineAssociation(options.projectPath);
    if (!engineAssociation) {
      throw new Error(
        `[ATO] Could not resolve Unreal Engine directory. No valid ENGINE_DIR was found${dotEnvPath ? ` in ${dotEnvPath}` : ''}, and ${path.basename(options.projectPath)} does not define EngineAssociation.`,
      );
    }

    const associatedEngineDirectory = this.engineAssociationResolver.resolveEngineDirectory(engineAssociation);
    if (associatedEngineDirectory) {
      return associatedEngineDirectory;
    }

    throw new Error(
      `[ATO] Could not resolve Unreal Engine directory. EngineAssociation '${engineAssociation}' from ${path.basename(options.projectPath)} was not found in Unreal installed engine associations for ${process.platform}.`,
    );
  }
}

export function resolveAutomationContext(
  options: AutomationContextResolutionOptions = {},
  dependencies: AutomationContextResolverDependencies = {},
) {
  return new AutomationContextResolver(dependencies).resolve(options);
}

function parseDotEnvFile(dotEnvPath: string) {
  try {
    return dotenv.parse(fs.readFileSync(dotEnvPath, 'utf-8'));
  } catch {
    return undefined;
  }
}

function readEngineAssociation(projectPath: string) {
  try {
    const projectFile = fs.readFileSync(projectPath, 'utf-8');
    const parsedProject = JSON.parse(projectFile) as { EngineAssociation?: string };
    return parsedProject.EngineAssociation?.trim() || undefined;
  } catch (error) {
    throw new Error(
      `[ATO] Failed to read EngineAssociation from ${projectPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveEntryDirectory(rawArgv: string[] | undefined, cwd: string) {
  const scriptArg = rawArgv?.[1];
  if (!scriptArg || scriptArg.startsWith('-')) {
    return cwd;
  }

  const resolvedScriptPath = path.isAbsolute(scriptArg) ? scriptArg : path.resolve(cwd, scriptArg);
  return path.dirname(resolvedScriptPath);
}
