import * as path from 'node:path';
import type { FileSystem } from './FileSystem';

export class OutputDirectoryGuard {
  constructor(private readonly fileSystem: FileSystem) {}

  validate(targetDirectory: string) {
    const resolvedTarget = path.resolve(targetDirectory);
    this.failIfInsideUnrealProjectOrPlugin(resolvedTarget);
    this.failIfDirectoryIsNotEmpty(resolvedTarget);
  }

  private failIfDirectoryIsNotEmpty(targetDirectory: string) {
    if (!this.fileSystem.exists(targetDirectory)) {
      return;
    }

    if (!this.fileSystem.isDirectory(targetDirectory)) {
      throw new Error(`[create-atc-harness] Output path exists and is not a directory: ${targetDirectory}`);
    }

    const entries = this.fileSystem.listFiles(targetDirectory);
    if (entries.length > 0) {
      throw new Error(`[create-atc-harness] Output directory must be empty: ${targetDirectory}`);
    }
  }

  private failIfInsideUnrealProjectOrPlugin(targetDirectory: string) {
    let currentDirectory = targetDirectory;
    while (true) {
      if (this.isUnrealProjectOrPluginDirectory(currentDirectory)) {
        throw new Error(
          `[create-atc-harness] Refusing to create harness inside Unreal project/plugin tree: ${targetDirectory}`,
        );
      }

      const parent = path.dirname(currentDirectory);
      if (parent === currentDirectory) {
        return;
      }
      currentDirectory = parent;
    }
  }

  private isUnrealProjectOrPluginDirectory(directory: string) {
    if (!this.fileSystem.exists(directory) || !this.fileSystem.isDirectory(directory)) {
      return false;
    }

    return this.fileSystem
      .listFiles(directory)
      .some((entry) => entry.toLowerCase().endsWith('.uproject') || entry.toLowerCase().endsWith('.uplugin'));
  }
}
