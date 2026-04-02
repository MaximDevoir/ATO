import * as path from 'node:path';
import { FileManifestRepository, UAPMApplication } from 'uapm';
import type { FileSystem } from './FileSystem';

export interface AddDependencyOptions {
  pin?: boolean;
  harnessed?: boolean;
  force?: boolean;
}

export interface UAPMServiceLike {
  ensureProjectInitialized(projectDirectory: string): Promise<void>;
  addDependency(projectDirectory: string, source: string, options?: AddDependencyOptions): Promise<void>;
  install(projectDirectory: string, force?: boolean): Promise<void>;
}

export class UAPMService implements UAPMServiceLike {
  private readonly application = new UAPMApplication();
  private readonly manifestRepository = new FileManifestRepository();

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
    await this.application.run({
      command: 'init',
      cwd: projectDirectory,
      args: [],
      type: 'project',
      name: projectName,
      force: false,
      pin: false,
      harnessed: false,
    });
  }

  async addDependency(projectDirectory: string, source: string, options: AddDependencyOptions = {}) {
    await this.application.run({
      command: 'add',
      cwd: projectDirectory,
      args: [source],
      force: options.force === true,
      pin: options.pin === true,
      harnessed: options.harnessed === true,
    });
  }

  async install(projectDirectory: string, force = false) {
    await this.application.run({
      command: 'install',
      cwd: projectDirectory,
      args: [],
      force,
      pin: false,
      harnessed: false,
    });
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
