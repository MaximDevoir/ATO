import { DependencyInstaller } from '../install/DependencyInstaller';
import type { LockfileRepository } from '../lockfile/LockfileRepository';
import { LockfileSynchronizer } from '../lockfile/LockfileSynchronizer';
import type { ManifestRepository } from '../manifest/ManifestRepository';
import { PostinstallRunner } from '../postinstall/PostinstallRunner';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient } from '../services/GitClient';
import type { Reporter } from '../ui/ConsoleReporter';
import type { Command } from './Command';

export interface InstallCommandOptions {
  cwd: string;
  force: boolean;
}

export class InstallCommand implements Command {
  constructor(
    private readonly options: InstallCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly lockfileRepository: LockfileRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
    private readonly reporter: Reporter,
    private readonly postinstallRunner: PostinstallRunner = new PostinstallRunner(),
  ) {}

  async execute() {
    if (!this.manifestRepository.exists(this.options.cwd)) {
      throw new Error('[uapkg] No uapkg.json found in current directory');
    }

    const synchronizer = new LockfileSynchronizer(
      this.manifestRepository,
      this.lockfileRepository,
      this.fileSystem,
      this.gitClient,
      this.reporter,
    );
    const hasLockfile = this.lockfileRepository.exists(this.options.cwd);
    const synchronized = await synchronizer.synchronize(this.options.cwd, {
      force: this.options.force,
      refresh: !hasLockfile,
    });

    await new DependencyInstaller(this.fileSystem, this.gitClient).installAll(
      synchronized.manifestType,
      this.options.cwd,
      synchronized.packages,
    );
    await this.postinstallRunner.run(this.options.cwd, synchronized.manifestType, synchronized.packages, this.reporter);

    this.reporter.info(`[uapkg] Installed ${synchronized.packages.length} dependency packages`);
    return 0;
  }
}
