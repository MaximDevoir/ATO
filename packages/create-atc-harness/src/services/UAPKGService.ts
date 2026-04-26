import * as path from 'node:path';
import { createUAPKGCommandLineFactory, UAPKGApplication } from '@uapkg/cli';
import { ManifestReader } from '@uapkg/package-manifest';
import type { FileSystem } from './FileSystem';

export interface AddDependencyOptions {
  pin?: boolean;
  /** Add to devDependencies (old "harnessed" semantics). */
  dev?: boolean;
  force?: boolean;
}

export interface UAPKGServiceLike {
  ensureProjectInitialized(projectDirectory: string): Promise<void>;
  addDependency(projectDirectory: string, source: string, options?: AddDependencyOptions): Promise<void>;
  install(projectDirectory: string, force?: boolean): Promise<void>;
}

export class UAPKGService implements UAPKGServiceLike {
  private readonly application = new UAPKGApplication();
  private readonly manifestReader = new ManifestReader();
  private readonly commandLineFactory = createUAPKGCommandLineFactory();

  constructor(private readonly fileSystem: FileSystem) {}

  async ensureProjectInitialized(projectDirectory: string) {
    const existing = await this.manifestReader.read(projectDirectory);
    if (existing.ok) {
      if (existing.value.kind === 'project') return;
      throw new Error(`[create-atc-harness] Expected harness manifest kind 'project', found '${existing.value.kind}'`);
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
        dev: options.dev,
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
