import { DependencyInstaller } from '../install/DependencyInstaller';
import type { LockfileRepository } from '../lockfile/LockfileRepository';
import { LockfileSynchronizer } from '../lockfile/LockfileSynchronizer';
import type { ManifestRepository } from '../manifest/ManifestRepository';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient } from '../services/GitClient';
import type { Reporter } from '../ui/ConsoleReporter';
import type { Command } from './Command';

export interface UpdateCommandOptions {
  cwd: string;
  force: boolean;
}

export class UpdateCommand implements Command {
  constructor(
    private readonly options: UpdateCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly lockfileRepository: LockfileRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
    private readonly reporter: Reporter,
  ) {}

  async execute() {
    if (!this.manifestRepository.exists(this.options.cwd)) {
      throw new Error('[uapm] No uapm.json found in current directory');
    }

    const synchronizer = new LockfileSynchronizer(
      this.manifestRepository,
      this.lockfileRepository,
      this.fileSystem,
      this.gitClient,
      this.reporter,
    );
    const synchronized = await synchronizer.synchronize(this.options.cwd, {
      force: this.options.force,
      refresh: true,
    });

    await new DependencyInstaller(this.fileSystem, this.gitClient).installAll(
      synchronized.manifestType,
      this.options.cwd,
      synchronized.packages,
    );

    this.reporter.info(`[uapm] Updated ${synchronized.packages.length} dependency packages`);
    return 0;
  }
}
