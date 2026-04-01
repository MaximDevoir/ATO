import { DependencyGraphBuilder } from '../graph/DependencyGraphBuilder';
import { DependencyResolver } from '../graph/DependencyResolver';
import { DependencyInstaller } from '../install/DependencyInstaller';
import type { ManifestRepository } from '../manifest/ManifestRepository';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient } from '../services/GitClient';
import type { Reporter } from '../ui/ConsoleReporter';
import type { Command } from './Command';

export interface InstallCommandOptions {
  cwd: string;
}

export class InstallCommand implements Command {
  constructor(
    private readonly options: InstallCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
    private readonly reporter: Reporter,
  ) {}

  async execute() {
    if (!this.manifestRepository.exists(this.options.cwd)) {
      throw new Error('[uapm] No uapm.json found in current directory');
    }

    const graphBuilder = new DependencyGraphBuilder(this.manifestRepository, this.fileSystem, this.gitClient);
    const buildResult = await graphBuilder.buildFromRoot(this.options.cwd);
    const manifests = buildResult.nodes.map((node) => node.manifest);

    const resolver = new DependencyResolver(this.gitClient);
    const resolution = await resolver.resolve(buildResult.rootManifest, manifests);

    for (const warning of resolution.warnings) {
      this.reporter.warn(warning);
    }

    const installer = new DependencyInstaller(this.fileSystem, this.gitClient);
    await installer.installAll(buildResult.rootManifest.type, this.options.cwd, resolution.resolvedDependencies);

    this.reporter.info(`[uapm] Installed ${resolution.resolvedDependencies.length} dependency packages`);
    return 0;
  }
}
