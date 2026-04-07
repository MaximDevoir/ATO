import { DependencyGraphBuilder } from '../graph/DependencyGraphBuilder.js';
import { DependencyResolver } from '../graph/DependencyResolver.js';
import type { ManifestRepository } from '../manifest/ManifestRepository.js';
import { PluginStateInspector } from '../safety/PluginStateInspector.js';
import { SafetyPolicy } from '../safety/SafetyPolicy.js';
import type { FileSystemService } from '../services/FileSystemService.js';
import type { GitClient } from '../services/GitClient.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import type { LockfileRepository } from './LockfileRepository.js';
import type { LockedPackage } from './UAPKGLockfile.js';

export interface LockfileSyncOptions {
  force: boolean;
  refresh: boolean;
}

export interface LockfileSyncResult {
  manifestType: 'project' | 'plugin';
  packages: LockedPackage[];
  warnings: string[];
}

export class LockfileSynchronizer {
  constructor(
    private readonly manifestRepository: ManifestRepository,
    private readonly lockfileRepository: LockfileRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
    private readonly reporter: Reporter,
    private readonly safetyPolicy: SafetyPolicy = new SafetyPolicy(),
  ) {}

  async synchronize(cwd: string, options: LockfileSyncOptions): Promise<LockfileSyncResult> {
    const rootManifest = this.manifestRepository.read(cwd);
    if (rootManifest.type === 'plugin') {
      const resolved = await this.resolveFromManifest(cwd);
      return {
        manifestType: 'plugin',
        packages: resolved,
        warnings: [],
      };
    }

    const hasLockfile = this.lockfileRepository.exists(cwd);
    if (hasLockfile && !options.refresh) {
      const locked = this.lockfileRepository.read(cwd).package;
      return {
        manifestType: rootManifest.type,
        packages: locked,
        warnings: [],
      };
    }

    const harnessedNames = new Set(rootManifest.harnessedPlugins ?? []);
    const desiredPackages = (await this.resolveFromManifest(cwd)).map((pkg) => ({
      ...pkg,
      harnessed: harnessedNames.has(pkg.name),
    }));
    const currentLockedPackages = hasLockfile ? this.lockfileRepository.read(cwd).package : [];
    const currentByName = new Map(currentLockedPackages.map((pkg) => [pkg.name, pkg]));
    const stateInspector = new PluginStateInspector(this.fileSystem, this.gitClient);
    const warnings: string[] = [];
    const finalPackages: LockedPackage[] = [];

    for (const desiredPackage of desiredPackages) {
      const currentLockedPackage = currentByName.get(desiredPackage.name);
      if (desiredPackage.harnessed && currentLockedPackage && !options.force) {
        finalPackages.push({
          ...currentLockedPackage,
          harnessed: true,
        });
        continue;
      }

      const currentState = await stateInspector.inspect(cwd, desiredPackage.name);
      const safetyDecision = this.safetyPolicy.canUpdatePackage(currentLockedPackage, currentState, options.force);
      if (!safetyDecision.allowed && currentLockedPackage) {
        const warning = `[uapkg] Skipping update for ${desiredPackage.name}. ${safetyDecision.reason}. Use --force to override.`;
        warnings.push(warning);
        this.reporter.warn(warning);
        finalPackages.push({
          ...currentLockedPackage,
          harnessed: desiredPackage.harnessed,
        });
        continue;
      }

      finalPackages.push(desiredPackage);
    }

    this.lockfileRepository.write(cwd, { package: finalPackages });
    return {
      manifestType: rootManifest.type,
      packages: finalPackages,
      warnings,
    };
  }

  private async resolveFromManifest(cwd: string) {
    const graphBuilder = new DependencyGraphBuilder(this.manifestRepository, this.fileSystem, this.gitClient);
    const built = await graphBuilder.buildFromRoot(cwd);
    const resolver = new DependencyResolver(this.gitClient);
    const resolved = await resolver.resolve(
      built.rootManifest,
      built.nodes.map((node) => node.manifest),
    );
    for (const warning of resolved.warnings) {
      this.reporter.warn(warning);
    }

    return resolved.resolvedDependencies.map((dependency) => ({
      name: dependency.name,
      source: dependency.source,
      version: dependency.version ?? 'HEAD',
      hash: dependency.hash ?? 'unknown',
      dependencies: dependency.dependencies ?? [],
    }));
  }
}
