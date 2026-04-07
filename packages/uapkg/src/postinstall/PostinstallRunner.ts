import type { ManifestType } from '../domain/UAPKGManifest.js';
import type { LockedPackage } from '../lockfile/UAPKGLockfile.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import { BuildCsInjector } from './BuildCsInjector.js';
import { PostinstallModuleSelector } from './PostinstallModuleSelector.js';
import { PostinstallScriptLoader } from './PostinstallScriptLoader.js';
import { ProjectFileLocator } from './ProjectFileLocator.js';
import { TargetCsInjector } from './TargetCsInjector.js';
import { UnrealSourceCatalogBuilder } from './UnrealSourceCatalog.js';
import { UProjectInjector } from './UProjectInjector.js';

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
