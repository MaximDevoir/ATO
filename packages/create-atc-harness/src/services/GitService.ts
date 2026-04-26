import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { simpleGit } from 'simple-git';
import type { FileSystem } from './FileSystem.js';

export interface GitService {
  isGitAvailable(): boolean;
  clone(repository: string, destinationDirectory: string, ref?: string): Promise<void>;
  hasLfsTracking(repositoryDirectory: string): boolean;
  isGitLfsAvailable(): boolean;
  pullLfs(repositoryDirectory: string): Promise<void>;
}

export class SimpleGitService implements GitService {
  constructor(private readonly fileSystem: FileSystem) {}

  isGitAvailable() {
    return spawnSync('git', ['--version'], { windowsHide: true }).status === 0;
  }

  async clone(repository: string, destinationDirectory: string, ref?: string) {
    const cloneArgs = ['--depth', '1'];
    if (ref) {
      cloneArgs.push('--branch', ref);
    }
    await simpleGit().clone(repository, destinationDirectory, cloneArgs);
  }

  hasLfsTracking(repositoryDirectory: string) {
    const attributesFilePath = path.join(repositoryDirectory, '.gitattributes');
    if (!this.fileSystem.exists(attributesFilePath)) {
      return false;
    }

    const attributes = this.fileSystem.readText(attributesFilePath);
    return /filter=lfs/.test(attributes);
  }

  isGitLfsAvailable() {
    return spawnSync('git', ['lfs', 'version'], { stdio: 'ignore', windowsHide: true }).status === 0;
  }

  async pullLfs(repositoryDirectory: string) {
    await simpleGit(repositoryDirectory).raw(['lfs', 'pull']);
  }
}
