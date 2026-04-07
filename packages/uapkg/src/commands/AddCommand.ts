import type { Dependency, DependencyOverride, UAPKGManifest } from '../domain/UAPKGManifest.js';
import { DependencyInstaller } from '../install/DependencyInstaller.js';
import type { LockfileRepository } from '../lockfile/LockfileRepository.js';
import { LockfileSynchronizer } from '../lockfile/LockfileSynchronizer.js';
import type { ManifestRepository } from '../manifest/ManifestRepository.js';
import { PostinstallRunner } from '../postinstall/PostinstallRunner.js';
import type { FileSystemService } from '../services/FileSystemService.js';
import type { GitClient } from '../services/GitClient.js';
import { parseGitReference } from '../services/GitReferenceParser.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import { normalizeAddedDependencyVersion } from '../utils/VersionUtils.js';
import type { Command } from './Command.js';

export interface AddCommandOptions {
  cwd: string;
  source: string;
  force: boolean;
  pin: boolean;
  harnessed: boolean;
}

export class AddCommand implements Command {
  constructor(
    private readonly options: AddCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly lockfileRepository: LockfileRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
    private readonly reporter: Reporter,
    private readonly postinstallRunner: PostinstallRunner = new PostinstallRunner(),
  ) {}

  async execute() {
    const manifest = this.manifestRepository.read(this.options.cwd);
    const source = this.options.source.trim();
    if (!source) {
      throw new Error('[uapkg] add requires a dependency source');
    }

    const dependency = await this.resolveDependencyDescriptor(source);
    const dependencies = manifest.dependencies ?? [];
    const existingIndex = dependencies.findIndex((item: Dependency) => item.name === dependency.name);
    if (existingIndex >= 0) {
      dependencies[existingIndex] = dependency;
      this.reporter.warn(`[uapkg] Replaced existing dependency '${dependency.name}'`);
    } else {
      dependencies.push(dependency);
    }
    manifest.dependencies = dependencies;
    this.applyProjectLevelFlags(manifest, dependency);
    this.manifestRepository.write(this.options.cwd, manifest);

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

    this.reporter.info(`[uapkg] Added dependency ${dependency.name} from ${dependency.source}`);
    return 0;
  }

  private applyProjectLevelFlags(manifest: UAPKGManifest, dependency: Dependency) {
    if (this.options.pin) {
      if (manifest.type !== 'project') {
        this.reporter.warn('[uapkg] --pin is only meaningful at project level; ignoring.');
      } else {
        const overrides = manifest.overrides ?? [];
        const override: DependencyOverride = {
          name: dependency.name,
          source: dependency.source,
          version: dependency.version,
        };
        const existingIndex = overrides.findIndex((entry) => entry.name === dependency.name);
        if (existingIndex >= 0) {
          overrides[existingIndex] = override;
        } else {
          overrides.push(override);
        }
        manifest.overrides = overrides;
      }
    }

    if (this.options.harnessed) {
      if (manifest.type !== 'project') {
        this.reporter.warn('[uapkg] --harnessed is only meaningful at project level; ignoring.');
      } else {
        const harnessedPlugins = new Set(manifest.harnessedPlugins ?? []);
        harnessedPlugins.add(dependency.name);
        manifest.harnessedPlugins = [...harnessedPlugins];
      }
    }
  }

  private async resolveDependencyDescriptor(source: string): Promise<Dependency> {
    if (source.startsWith('file:')) {
      const manifest = this.manifestRepository.read(
        this.fileSystem.resolve(this.options.cwd, source.slice('file:'.length)),
      );
      return {
        name: manifest.name,
        source,
      };
    }

    const parsed = parseGitReference(source);
    const tempDirectory = this.fileSystem.createTempDir('uapkg-add-');
    try {
      await this.gitClient.clone(parsed, tempDirectory);
      const manifest = this.manifestRepository.read(tempDirectory);
      return {
        name: manifest.name,
        source: parsed.repositoryUrl,
        version: normalizeAddedDependencyVersion(parsed.ref),
      };
    } finally {
      this.fileSystem.removeDir(tempDirectory);
    }
  }
}
