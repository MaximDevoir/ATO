import * as path from 'node:path';
import { stdin, stdout } from 'node:process';
import readline from 'node:readline/promises';
import { EngineAssociationResolver, isValidEngineDirectory } from '@maximdevoir/engine-association-resolver';
import dotenv from 'dotenv';
import isCI from 'is-ci';
import type { FileSystem } from './FileSystem';
import type { InstalledEngineLocator } from './InstalledEngineLocator';

export interface ResolvedEngineContext {
  engineDirectory?: string;
  engineAssociation?: string;
}

export interface EngineDirectoryResolverOptions {
  engineAssociationOption?: string;
  cwd: string;
  pluginManifestFolder: string;
}

export class EngineDirectoryResolver {
  private readonly engineAssociationResolver: EngineAssociationResolver;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly installedEngineLocator: InstalledEngineLocator,
  ) {
    this.engineAssociationResolver = new EngineAssociationResolver();
  }

  async resolve(options: EngineDirectoryResolverOptions): Promise<ResolvedEngineContext> {
    const explicitOption = options.engineAssociationOption?.trim();
    if (explicitOption) {
      return this.resolveExplicitAssociation(explicitOption, options.cwd);
    }

    const dotenvEngineDir = this.readEngineDirFromDotEnv(options.cwd, options.pluginManifestFolder);
    const envEngineDir = dotenvEngineDir || process.env.ENGINE_DIR?.trim();
    if (envEngineDir && this.isValidDirectoryCandidate(envEngineDir, options.cwd)) {
      const resolvedDirectory = path.resolve(options.cwd, envEngineDir);
      return { engineDirectory: resolvedDirectory };
    }

    const installedEngines = this.installedEngineLocator.listInstalledEngines();
    if (installedEngines.length === 0) {
      if (isCI) {
        throw new Error(
          '[create-atc-harness] No installed engines were discovered. In CI you must provide --engineAssociation or ENGINE_DIR.',
        );
      }
      return {};
    }

    if (isCI) {
      throw new Error(
        '[create-atc-harness] --engineAssociation was not provided. Refusing to assume engine selection in CI.',
      );
    }

    const selected = await this.promptForAssociation(installedEngines.map((engine) => engine.association));
    const directory = this.engineAssociationResolver.resolveEngineDirectory(selected);
    if (!directory) {
      throw new Error(`[create-atc-harness] Failed to resolve selected EngineAssociation: ${selected}`);
    }
    return { engineAssociation: selected, engineDirectory: directory };
  }

  private resolveExplicitAssociation(explicitOption: string, cwd: string): ResolvedEngineContext {
    if (explicitOption === 'first') {
      const firstEngine = this.installedEngineLocator.listInstalledEngines()[0];
      if (!firstEngine) {
        throw new Error('[create-atc-harness] --engineAssociation=first was provided but no engines were discovered');
      }
      return { engineAssociation: firstEngine.association, engineDirectory: firstEngine.directory };
    }

    if (this.isValidDirectoryCandidate(explicitOption, cwd)) {
      return { engineDirectory: path.resolve(cwd, explicitOption) };
    }

    const resolvedByAssociation = this.engineAssociationResolver.resolveEngineDirectory(explicitOption);
    if (!resolvedByAssociation) {
      throw new Error(
        `[create-atc-harness] --engineAssociation did not resolve to an installed engine: ${explicitOption}`,
      );
    }

    return {
      engineAssociation: explicitOption,
      engineDirectory: resolvedByAssociation,
    };
  }

  private readEngineDirFromDotEnv(cwd: string, pluginManifestFolder: string) {
    const candidates = [path.join(cwd, '.env'), path.join(pluginManifestFolder, '.env')];
    for (const candidate of candidates) {
      if (!this.fileSystem.exists(candidate)) {
        continue;
      }
      try {
        const parsed = dotenv.parse(this.fileSystem.readText(candidate));
        const engineDir = parsed.ENGINE_DIR?.trim();
        if (engineDir) {
          return engineDir;
        }
      } catch {}
    }
    return undefined;
  }

  private isValidDirectoryCandidate(candidate: string, cwd: string) {
    const resolved = path.resolve(cwd, candidate);
    return isValidEngineDirectory(resolved);
  }

  private async promptForAssociation(associations: string[]) {
    if (!stdin.isTTY || !stdout.isTTY) {
      return associations[0];
    }

    const prompt = readline.createInterface({ input: stdin, output: stdout });
    try {
      stdout.write('[create-atc-harness] Select EngineAssociation:\n');
      associations.forEach((association, index) => {
        stdout.write(`  ${index + 1}. ${association}\n`);
      });
      const answer = await prompt.question('Enter selection number: ');
      const selectedIndex = Number.parseInt(answer, 10);
      if (!Number.isFinite(selectedIndex) || selectedIndex < 1 || selectedIndex > associations.length) {
        throw new Error(`[create-atc-harness] Invalid selection: ${answer}`);
      }
      return associations[selectedIndex - 1];
    } finally {
      prompt.close();
    }
  }
}
