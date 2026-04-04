import * as path from 'node:path';
import type { CommandLineOptions } from '../domain/CommandLineOptions';
import { HarnessCreationResult, HarnessResultState } from '../domain/HarnessCreationResult';
import { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import { EngineTemplateHarnessCreator } from '../harness/EngineTemplateHarnessCreator';
import { GitHarnessCreator } from '../harness/GitHarnessCreator';
import { Harness } from '../harness/Harness';
import type { HarnessCreator } from '../harness/HarnessCreator';
import { GitManifestSource } from '../manifest/GitManifestSource';
import { LocalPathManifestSource } from '../manifest/LocalPathManifestSource';
import type { ManifestResolution, ManifestSource } from '../manifest/ManifestSource';
import {
  resolvePluginFileStemFromManifestFolder,
  resolvePluginRootFromManifestFolder,
} from '../manifest/manifestHelpers';
import { EngineDirectoryResolver } from '../services/EngineDirectoryResolver';
import type { FileSystem } from '../services/FileSystem';
import type { GitService } from '../services/GitService';
import { SimpleGitService } from '../services/GitService';
import { isGitLikeReference, parseGitReference } from '../services/GitUrl';
import { InstalledEngineLocator } from '../services/InstalledEngineLocator';
import { NodeFileSystem } from '../services/NodeFileSystem';
import { OutputDirectoryGuard } from '../services/OutputDirectoryGuard';
import { UAPKGService, type UAPKGServiceLike } from '../services/UAPKGService';
import { HarnessTerminal } from '../ui/HarnessTerminal';
import type { LiveStatusModelLike } from '../ui/LiveStatusModel';
import { ModelBackedLiveStatusHandle } from '../ui/ModelBackedLiveStatusHandle';

export interface OutputDirectoryValidator {
  validate(targetDirectory: string): void;
}

export interface HarnessTerminalLike {
  start(): void;
  stop(): void;
  getModel(): LiveStatusModelLike;
}

export interface CreateATCHarnessDependencies {
  fileSystem?: FileSystem;
  gitService?: GitService;
  manifestSources?: ManifestSource[];
  harnessCreators?: HarnessCreator[];
  outputDirectoryGuard?: OutputDirectoryValidator;
  engineDirectoryResolver?: EngineDirectoryResolver;
  terminal?: HarnessTerminalLike;
  uapkgService?: UAPKGServiceLike;
}

export class CreateATCHarness {
  readonly Harness = new Harness();
  private readonly fileSystem: FileSystem;
  private readonly manifestSources: ManifestSource[];
  private readonly outputDirectoryGuard: OutputDirectoryValidator;
  private readonly engineDirectoryResolver: EngineDirectoryResolver;
  private readonly terminal: HarnessTerminalLike;
  private readonly uapkgService: UAPKGServiceLike;

  constructor(
    private readonly settings: CommandLineOptions,
    dependencies: CreateATCHarnessDependencies = {},
  ) {
    this.fileSystem = dependencies.fileSystem ?? new NodeFileSystem();
    const gitService = dependencies.gitService ?? new SimpleGitService(this.fileSystem);

    this.outputDirectoryGuard = dependencies.outputDirectoryGuard ?? new OutputDirectoryGuard(this.fileSystem);
    this.engineDirectoryResolver =
      dependencies.engineDirectoryResolver ??
      new EngineDirectoryResolver(this.fileSystem, new InstalledEngineLocator(this.fileSystem));
    this.terminal = dependencies.terminal ?? new HarnessTerminal();
    this.uapkgService = dependencies.uapkgService ?? new UAPKGService(this.fileSystem);

    this.manifestSources = dependencies.manifestSources ?? [
      new LocalPathManifestSource(this.fileSystem),
      new GitManifestSource(this.fileSystem, gitService),
    ];

    const harnessCreators = dependencies.harnessCreators ?? [
      new EngineTemplateHarnessCreator(this.fileSystem),
      new GitHarnessCreator(gitService),
    ];
    for (const harnessCreator of harnessCreators) {
      this.Harness.addHarness(harnessCreator);
    }
  }

  addHarness(harnessCreator: HarnessCreator) {
    this.Harness.addHarness(harnessCreator);
  }

  async run() {
    const result = new HarnessCreationResult();
    this.terminal.start();
    const status = new ModelBackedLiveStatusHandle(this.terminal.getModel());

    let manifestResolution: ManifestResolution | undefined;
    try {
      const manifestSource = this.resolveManifestSource(this.settings.manifestString);
      status.setStatus(`[Manifest] Resolving manifest via ${manifestSource.name}`);
      manifestResolution = await manifestSource.resolveManifest(
        {
          manifestString: this.settings.manifestString,
          outputRootDirectory: this.settings.outputRootDirectory ?? process.cwd(),
        },
        result,
        status,
      );
      const outputRoot = this.resolveOutputRootDirectory(manifestResolution);
      this.outputDirectoryGuard.validate(outputRoot);

      const harnessString = this.settings.harness?.trim() || manifestResolution.manifest.harness;
      const selectedHarnessCreator = this.resolveHarnessCreator(harnessString);
      const shouldResolveEngine =
        selectedHarnessCreator.name === 'EngineTemplate' || Boolean(this.settings.engineAssociation);
      const engine = shouldResolveEngine
        ? await this.engineDirectoryResolver.resolve({
            engineAssociationOption: this.settings.engineAssociation,
            cwd: process.cwd(),
            pluginManifestFolder: manifestResolution.manifestDirectory,
          })
        : {};

      const creationSettings = new HarnessCreationSettings({
        rootFolder: outputRoot,
        pluginManifestFolder: manifestResolution.manifestDirectory,
        harnessString,
        commandLineOptions: this.settings,
        engineAssociation: engine.engineAssociation,
        engineDirectory: engine.engineDirectory,
      });

      this.fileSystem.ensureDirectory(outputRoot);
      status.setStatus(`[Harness] Creating harness with ${selectedHarnessCreator.name}`);
      await selectedHarnessCreator.executeHarnessCreation(creationSettings, result, status);
      if (result.result === HarnessResultState.Fail) {
        return result;
      }

      status.setStatus('[UAPKG] Ensuring harness project has uapkg initialized...');
      await this.uapkgService.ensureProjectInitialized(outputRoot);

      const rootSourceSpecifier = this.resolveRootDependencySourceSpecifier(manifestResolution);
      status.setStatus(`[UAPKG] Harnessing ${manifestResolution.manifest.name ?? 'plugin'}...`);
      await this.uapkgService.addDependency(outputRoot, rootSourceSpecifier, {
        harnessed: true,
      });

      for (const dependencySpecifier of this.resolveDirectHarnessedDependencySourceSpecifiers(
        manifestResolution,
        result,
      )) {
        status.setStatus(`[UAPKG] Harnessing direct dependency ${dependencySpecifier.name}...`);
        await this.uapkgService.addDependency(outputRoot, dependencySpecifier.sourceSpecifier, {
          harnessed: true,
        });
      }

      status.setStatus('[UAPKG] Installing dependencies from uapkg.lock...');
      await this.uapkgService.install(outputRoot);
      status.setStatus('[Done] Harness creation finished');
      result.setResult(HarnessResultState.Success);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.addError(message, true);
      return result;
    } finally {
      manifestResolution?.cleanup?.();
      this.terminal.stop();
    }
  }

  private resolveRootDependencySourceSpecifier(manifestResolution: ManifestResolution) {
    if (isGitLikeReference(this.settings.manifestString)) {
      const parsed = parseGitReference(this.settings.manifestString);
      return parsed.ref ? `${parsed.repositoryUrl}@${parsed.ref}` : parsed.repositoryUrl;
    }

    const pluginRoot = resolvePluginRootFromManifestFolder(this.fileSystem, manifestResolution.manifestDirectory);
    return `file:${pluginRoot}`;
  }

  private resolveDirectHarnessedDependencySourceSpecifiers(
    manifestResolution: ManifestResolution,
    result: HarnessCreationResult,
  ) {
    const dependenciesByName = new Map(
      (manifestResolution.manifest.dependencies ?? []).map((dependency) => [dependency.name, dependency]),
    );

    return (manifestResolution.manifest.harnessedPlugins ?? [])
      .map((dependencyName) => {
        const dependency = dependenciesByName.get(dependencyName);
        if (!dependency) {
          result.addWarning(
            `[create-atc-harness] harnessedPlugins contains '${dependencyName}' but dependency was not declared in manifest.dependencies`,
          );
          return undefined;
        }

        return {
          name: dependency.name,
          sourceSpecifier: this.toSourceSpecifier(
            manifestResolution.manifestDirectory,
            dependency.source,
            dependency.version,
          ),
        };
      })
      .filter((value): value is { name: string; sourceSpecifier: string } => Boolean(value));
  }

  private toSourceSpecifier(baseDirectory: string, source: string, version?: string) {
    if (source.startsWith('file:')) {
      const rawPath = source.slice('file:'.length);
      const absolute = path.isAbsolute(rawPath) ? rawPath : path.resolve(baseDirectory, rawPath);
      return `file:${absolute}`;
    }

    return version ? `${source}@${version}` : source;
  }

  private resolveOutputRootDirectory(manifestResolution: ManifestResolution) {
    if (this.settings.outputRootDirectory?.trim()) {
      return path.resolve(this.settings.outputRootDirectory);
    }

    const manifestName = manifestResolution.manifest.name?.trim();
    if (manifestName) {
      return path.resolve(`${manifestName}Harness`);
    }

    const pluginFileStem = resolvePluginFileStemFromManifestFolder(
      this.fileSystem,
      manifestResolution.manifestDirectory,
    );
    return path.resolve(`${pluginFileStem}Harness`);
  }

  private resolveManifestSource(manifestString: string) {
    const source = this.manifestSources.find((candidate) => candidate.canAcceptManifestString(manifestString));
    if (!source) {
      throw new Error(`[create-atc-harness] No manifest source can handle: ${manifestString}`);
    }
    return source;
  }

  private resolveHarnessCreator(harnessString: string) {
    if (this.settings.harness?.trim()) {
      const forced = this.Harness.getByName(this.settings.harness);
      if (!forced) {
        throw new Error(`[create-atc-harness] Unknown harness creator: ${this.settings.harness}`);
      }
      return forced;
    }

    const compatible = this.Harness.findCompatible(harnessString);
    if (!compatible) {
      const known = this.Harness.list()
        .map((creator) => creator.name)
        .join(', ');
      throw new Error(`[create-atc-harness] No harness creator accepted '${harnessString}'. Known creators: ${known}`);
    }
    return compatible;
  }
}
