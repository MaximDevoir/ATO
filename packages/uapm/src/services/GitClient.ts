import * as path from 'node:path';
import { simpleGit } from 'simple-git';
import type { ParsedGitReference } from './GitReferenceParser';

export interface RemoteRefInfo {
  name: string;
  hash: string;
  kind: 'tag' | 'branch';
}

export interface GitClient {
  clone(target: ParsedGitReference, destinationDirectory: string): Promise<void>;
  addSubmodule(target: ParsedGitReference, destinationDirectory: string, projectRoot: string): Promise<void>;
  listRemoteRefs(repositoryUrl: string): Promise<RemoteRefInfo[]>;
}

export class SimpleGitClient implements GitClient {
  async clone(target: ParsedGitReference, destinationDirectory: string) {
    const cloneArgs = ['--depth', '1'];
    if (target.ref) {
      cloneArgs.push('--branch', target.ref);
    }
    await simpleGit().clone(target.repositoryUrl, destinationDirectory, cloneArgs);
  }

  async addSubmodule(target: ParsedGitReference, destinationDirectory: string, projectRoot: string) {
    const relativeDestination = path.relative(projectRoot, destinationDirectory).replace(/\\/g, '/');
    await simpleGit(projectRoot).raw(['submodule', 'add', target.repositoryUrl, relativeDestination]);
    if (target.ref) {
      await simpleGit(destinationDirectory).checkout(target.ref);
    }
  }

  async listRemoteRefs(repositoryUrl: string) {
    const output = await simpleGit().raw(['ls-remote', '--tags', '--heads', repositoryUrl]);
    const refs: RemoteRefInfo[] = [];
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [hash, ref] = trimmed.split(/\s+/);
      if (!hash || !ref) {
        continue;
      }
      if (ref.startsWith('refs/tags/')) {
        const name = ref.replace('refs/tags/', '').replace(/\^\{\}$/, '');
        refs.push({ name, hash, kind: 'tag' });
      } else if (ref.startsWith('refs/heads/')) {
        refs.push({ name: ref.replace('refs/heads/', ''), hash, kind: 'branch' });
      }
    }
    return refs;
  }
}
