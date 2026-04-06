import * as path from 'node:path';
import { createUAPKGCommandLineFactory, FileManifestRepository, UAPKGApplication } from 'uapkg';
import type { FileSystem } from './FileSystem';

export interface AddDependencyOptions {
  pin?: boolean;
  harnessed?: boolean;
  force?: boolean;
}

export interface UAPKGServiceLike {
  ensureProjectInitialized(projectDirectory: string): Promise<void>;
  addDependency(projectDirectory: string, source: string, options?: AddDependencyOptions): Promise<void>;
  install(projectDirectory: string, force?: boolean): Promise<void>;
}

export class UAPKGService implements UAPKGServiceLike {
  private readonly application = new UAPKGApplication();
  private readonly manifestRepository = new FileManifestRepository();
  private readonly commandLineFactory = createUAPKGCommandLineFactory();

  constructor(private readonly fileSystem: FileSystem) {}

  async ensureProjectInitialized(projectDirectory: string) {
    if (this.manifestRepository.exists(projectDirectory)) {
      const manifest = this.manifestRepository.read(projectDirectory);
      if (manifest.type === 'project') {
        return;
      }
      throw new Error(`[create-atc-harness] Expected harness manifest type 'project', found '${manifest.type}'`);
    }

    const projectName = this.resolveProjectName(projectDirectory);
    await this.application.run(
      this.commandLineFactory.createInit({
        cwd: projectDirectory,
        type: 'project',
        name: projectName,
      }),
    );
  }

  async addDependency(projectDirectory: string, source: string, options: AddDependencyOptions = {}) {
    await this.application.run(
      this.commandLineFactory.createAdd(source, {
        cwd: projectDirectory,
        force: options.force,
        pin: options.pin,
        harnessed: options.harnessed,
      }),
    );
  }

  async install(projectDirectory: string, force = false) {
    await this.application.run(
      this.commandLineFactory.createInstall({
        cwd: projectDirectory,
        force,
      }),
    );
  }

  private resolveProjectName(projectDirectory: string) {
    const projectFile = this.fileSystem
      .listFiles(projectDirectory)
      .find((entry) => entry.toLowerCase().endsWith('.uproject'));
    if (projectFile) {
      return path.parse(projectFile).name;
    }
    return path.basename(projectDirectory);
  }
}
