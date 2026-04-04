import * as path from 'node:path';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient, GitRepositoryState } from '../services/GitClient';

export class PluginStateInspector {
  constructor(
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
  ) {}

  async inspect(rootDirectory: string, packageName: string): Promise<GitRepositoryState | undefined> {
    const pluginDirectory = path.join(rootDirectory, 'Plugins', packageName);
    if (!this.fileSystem.exists(pluginDirectory)) {
      return undefined;
    }
    return await this.gitClient.inspectRepository(pluginDirectory);
  }
}
