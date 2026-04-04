import { FileManifestRepository, type ManifestRepository } from '../manifest/ManifestRepository';
import { ProjectFileLocator } from './ProjectFileLocator';
import { UProjectMetadataReader } from './UProjectMetadataReader';

export class PostinstallModuleSelector {
  constructor(
    private readonly manifestRepository: ManifestRepository = new FileManifestRepository(),
    private readonly projectFileLocator: ProjectFileLocator = new ProjectFileLocator(),
    private readonly uprojectReader: UProjectMetadataReader = new UProjectMetadataReader(),
  ) {}

  resolve(projectRoot: string) {
    const explicitModules = this.readExplicitPostinstallModules(projectRoot);
    if (explicitModules) {
      return explicitModules;
    }

    const uprojectPath = this.projectFileLocator.findProjectFile(projectRoot);
    const discoveredModules = this.uprojectReader.readModuleNames(uprojectPath);
    if (discoveredModules.length === 0) {
      throw new Error(
        `[uapkg] No modules discovered from ${uprojectPath}. Define project postinstall modules in uapkg.json (postinstall.modules) to continue.`,
      );
    }
    return discoveredModules;
  }

  private readExplicitPostinstallModules(projectRoot: string) {
    if (!this.manifestRepository.exists(projectRoot)) {
      return undefined;
    }

    const manifest = this.manifestRepository.read(projectRoot);
    const modules = manifest.postinstall?.modules;
    return modules ? [...modules] : undefined;
  }
}
