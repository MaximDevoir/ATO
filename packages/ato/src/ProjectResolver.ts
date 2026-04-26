import fs from 'node:fs';
import * as path from 'node:path';
import { isValidUProjectFile } from './UnrealPlatform.js';

export interface ProjectResolutionOptions {
  explicitProjectPath?: string;
  entryDirectory?: string;
  cwd?: string;
}

export interface ProjectResolutionResult {
  projectPath: string;
  projectRoot: string;
  projectName: string;
}

export class ProjectResolver {
  resolve(options: ProjectResolutionOptions): ProjectResolutionResult {
    const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const explicitProjectPath = options.explicitProjectPath?.trim();

    if (explicitProjectPath) {
      const resolvedProjectPath = path.resolve(cwd, explicitProjectPath);
      if (!isValidUProjectFile(resolvedProjectPath)) {
        throw new Error(`[ATO] Project file was provided but is invalid or missing: ${resolvedProjectPath}`);
      }

      return this.buildResult(resolvedProjectPath);
    }

    const searchRoot = path.resolve(options.entryDirectory ?? cwd);
    const discoveredProject = this.findNearestUProject(searchRoot);
    if (!discoveredProject) {
      throw new Error(
        `[ATO] Could not auto-discover a .uproject by searching upward from ${searchRoot}. Pass --Project explicitly or run the script from within an Unreal project.`,
      );
    }

    return this.buildResult(discoveredProject);
  }

  findNearestUProject(startDirectory: string) {
    let currentDirectory = path.resolve(startDirectory);

    while (true) {
      const candidates = fs
        .readdirSync(currentDirectory)
        .filter((entry) => entry.toLowerCase().endsWith('.uproject'))
        .sort((left, right) => left.localeCompare(right));

      if (candidates.length > 0) {
        return path.join(currentDirectory, candidates[0]);
      }

      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        return undefined;
      }

      currentDirectory = parentDirectory;
    }
  }

  findNearestFileUpwards(startDirectory: string, fileName: string) {
    let currentDirectory = path.resolve(startDirectory);

    while (true) {
      const candidatePath = path.join(currentDirectory, fileName);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }

      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        return undefined;
      }

      currentDirectory = parentDirectory;
    }
  }

  private buildResult(projectPath: string): ProjectResolutionResult {
    const projectRoot = path.dirname(projectPath);
    return {
      projectPath,
      projectRoot,
      projectName: path.basename(projectPath).replace(/\.uproject$/i, ''),
    };
  }
}
