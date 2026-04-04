import type { ManifestType } from '../domain/UAPKGManifest';
import type { LockedPackage } from '../lockfile/UAPKGLockfile';
import type { Reporter } from '../ui/ConsoleReporter';
import { BuildCsInjector } from './BuildCsInjector';
import { PostinstallModuleSelector } from './PostinstallModuleSelector';
import { PostinstallScriptLoader } from './PostinstallScriptLoader';
import { ProjectFileLocator } from './ProjectFileLocator';
import { TargetCsInjector } from './TargetCsInjector';
import { UnrealSourceCatalogBuilder } from './UnrealSourceCatalog';
import { UProjectInjector } from './UProjectInjector';

export class PostinstallRunner {
  constructor(
    private readonly scriptLoader: PostinstallScriptLoader = new PostinstallScriptLoader(),
    private readonly moduleSelector: PostinstallModuleSelector = new PostinstallModuleSelector(),
    private readonly sourceCatalogBuilder: UnrealSourceCatalogBuilder = new UnrealSourceCatalogBuilder(),
    private readonly buildCsInjector: BuildCsInjector = new BuildCsInjector(),
    private readonly targetCsInjector: TargetCsInjector = new TargetCsInjector(),
    private readonly projectFileLocator: ProjectFileLocator = new ProjectFileLocator(),
    private readonly uprojectInjector: UProjectInjector = new UProjectInjector(),
  ) {}

  async run(projectRoot: string, manifestType: ManifestType, packages: LockedPackage[], reporter: Reporter) {
    if (manifestType !== 'project') {
      return;
    }

    const scripts = await this.scriptLoader.loadFromInstalledPlugins(projectRoot, packages);
    if (scripts.length === 0) {
      return;
    }

    const hasModuleSetup = scripts.some((script) => Boolean(script.script.setupModules));
    const postinstallModules = hasModuleSetup ? this.moduleSelector.resolve(projectRoot) : [];
    const catalog = this.sourceCatalogBuilder.build(projectRoot, postinstallModules);

    for (const script of scripts) {
      if (script.script.setupModules) {
        for (const moduleName of postinstallModules) {
          const moduleFile = catalog.moduleFiles.get(moduleName);
          if (!moduleFile) {
            throw new Error(`[uapkg] Missing module mapping for ${moduleName}`);
          }
          this.buildCsInjector.apply(moduleFile, script.pluginName, script.script.setupModules);
        }
      }

      if (script.script.setupTargets) {
        for (const targetFile of catalog.targetFiles) {
          this.targetCsInjector.apply(targetFile, script.pluginName, script.script.setupTargets);
        }
      }

      const projectPlugins = script.script.setupProject?.plugins ?? [];
      if (projectPlugins.length > 0) {
        const uprojectPath = this.projectFileLocator.findProjectFile(projectRoot);
        this.uprojectInjector.apply(uprojectPath, projectPlugins);
      }
      reporter.info(`[uapkg] Applied postinstall from ${script.pluginName}`);
    }
  }
}
