import * as path from 'node:path';
import type { ManifestType } from '../domain/UAPMManifest';
import type { ResolvedDependency } from '../graph/DependencyTypes';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient } from '../services/GitClient';
import { parseGitReference } from '../services/GitReferenceParser';

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

      if (dependency.source.startsWith('file:')) {
        const sourceDirectory = this.fileSystem.resolve(rootDirectory, dependency.source.slice('file:'.length));
        this.fileSystem.copyDir(sourceDirectory, targetDirectory);
        continue;
      }

      const parsed = parseGitReference(
        dependency.version ? `${dependency.source}@${dependency.version}` : dependency.source,
      );

      if (rootType === 'harness') {
        await this.gitClient.clone(parsed, targetDirectory);
      } else {
        await this.gitClient.addSubmodule(parsed, targetDirectory, rootDirectory);
      }

      if (dependency.hash && dependency.hash !== 'unknown' && dependency.hash !== 'local') {
        await this.gitClient.checkout(targetDirectory, dependency.hash);
      }
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
