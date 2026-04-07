import * as path from 'node:path';
import type { ManifestType } from '../domain/UAPKGManifest.js';
import type { ResolvedDependency } from '../graph/DependencyTypes.js';
import type { FileSystemService } from '../services/FileSystemService.js';
import type { GitClient } from '../services/GitClient.js';
import { parseGitReference } from '../services/GitReferenceParser.js';

export class DependencyInstaller {
  constructor(
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
  ) {}

  async installAll(rootType: ManifestType, rootDirectory: string, dependencies: ResolvedDependency[]) {
    const pluginsDirectory = path.join(rootDirectory, 'Plugins');
    this.fileSystem.ensureDir(pluginsDirectory);

    for (const dependency of dependencies) {
      const targetDirectory = path.join(pluginsDirectory, dependency.name);
      if (this.fileSystem.exists(targetDirectory)) {
        await this.updateExistingPackage(targetDirectory, dependency);
        continue;
      }

      await this.installFreshDependency(rootType, rootDirectory, targetDirectory, dependency);
    }
  }

  private async installFreshDependency(
    _rootType: ManifestType,
    rootDirectory: string,
    targetDirectory: string,
    dependency: ResolvedDependency,
  ) {
    if (dependency.source.startsWith('file:')) {
      const sourceDirectory = this.fileSystem.resolve(rootDirectory, dependency.source.slice('file:'.length));
      this.fileSystem.copyDir(sourceDirectory, targetDirectory);
      return;
    }

    const ref = toGitRefCandidate(dependency.version);
    const parsed = parseGitReference(ref ? `${dependency.source}@${ref}` : dependency.source);
    await this.gitClient.addSubmodule(parsed, targetDirectory, rootDirectory);

    if (dependency.hash && dependency.hash !== 'unknown' && dependency.hash !== 'local') {
      await this.gitClient.checkout(targetDirectory, dependency.hash);
    }
  }

  private async updateExistingPackage(targetDirectory: string, dependency: ResolvedDependency) {
    if (dependency.source.startsWith('file:')) {
      return;
    }

    const currentState = await this.gitClient.inspectRepository(targetDirectory);
    if (!currentState.isRepository) {
      return;
    }
    if (!dependency.hash || dependency.hash === 'unknown' || dependency.hash === 'local') {
      return;
    }
    if (currentState.commit === dependency.hash) {
      return;
    }

    await this.gitClient.fetch(targetDirectory);
    await this.gitClient.checkout(targetDirectory, dependency.hash);
  }
}

function toGitRefCandidate(version: string | undefined) {
  if (!version) {
    return undefined;
  }
  const trimmed = version.trim();
  if (!trimmed || trimmed === '*') {
    return undefined;
  }
  return trimmed.replace(/^[\^~=]/, '');
}
