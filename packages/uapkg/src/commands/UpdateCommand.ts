import { DependencyInstaller } from '../install/DependencyInstaller.js';
import type { LockfileRepository } from '../lockfile/LockfileRepository.js';
import { LockfileSynchronizer } from '../lockfile/LockfileSynchronizer.js';
import type { ManifestRepository } from '../manifest/ManifestRepository.js';
import { PostinstallRunner } from '../postinstall/PostinstallRunner.js';
import type { FileSystemService } from '../services/FileSystemService.js';
import type { GitClient } from '../services/GitClient.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import type { Command } from './Command.js';

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
    const synchronized = await synchronizer.synchronize(this.options.cwd, {
      force: this.options.force,
      refresh: true,
    });

    await new DependencyInstaller(this.fileSystem, this.gitClient).installAll(
      synchronized.manifestType,
      this.options.cwd,
      synchronized.packages,
    );
    await this.postinstallRunner.run(this.options.cwd, synchronized.manifestType, synchronized.packages, this.reporter);

    this.reporter.info(`[uapkg] Updated ${synchronized.packages.length} dependency packages`);
    return 0;
  }
}
