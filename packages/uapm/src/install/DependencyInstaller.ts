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
    }
  }
}
