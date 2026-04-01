import * as path from 'node:path';
import { simpleGit } from 'simple-git';
import type { ParsedGitReference } from './GitReferenceParser';

export interface RemoteRefInfo {
  name: string;
  hash: string;
  kind: 'tag' | 'branch';
}

export interface GitRepositoryState {
  isRepository: boolean;
  branch?: string;
  commit?: string;
  remoteUrl?: string;
  isDirty: boolean;
}

export interface ResolvedRef {
  version: string;
  hash: string;
}

export interface GitClient {
  clone(target: ParsedGitReference, destinationDirectory: string): Promise<void>;
  addSubmodule(target: ParsedGitReference, destinationDirectory: string, projectRoot: string): Promise<void>;
  listRemoteRefs(repositoryUrl: string): Promise<RemoteRefInfo[]>;
  resolveRef(repositoryUrl: string, requestedVersion?: string): Promise<ResolvedRef>;
  inspectRepository(directory: string): Promise<GitRepositoryState>;
  checkout(directory: string, versionOrHash: string): Promise<void>;
  fetch(directory: string): Promise<void>;
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

  async resolveRef(repositoryUrl: string, requestedVersion?: string) {
    const version = requestedVersion?.trim() || 'HEAD';
    const output = await simpleGit().raw(['ls-remote', repositoryUrl, version === '*' ? 'HEAD' : version]);
    const firstLine = output.split(/\r?\n/).find((line) => line.trim());
    if (!firstLine) {
      throw new Error(`[uapm] Unable to resolve ref '${version}' from ${repositoryUrl}`);
    }

    const hash = firstLine.split(/\s+/)[0]?.trim();
    if (!hash) {
      throw new Error(`[uapm] Could not parse resolved hash for ${repositoryUrl}#${version}`);
    }

    return {
      version: requestedVersion?.trim() || 'HEAD',
      hash,
    };
  }

  async inspectRepository(directory: string): Promise<GitRepositoryState> {
    const git = simpleGit(directory);
    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return { isRepository: false, isDirty: false };
      }

      const status = await git.status();
      const branchRaw = await git.revparse(['--abbrev-ref', 'HEAD']);
      const commitRaw = await git.revparse(['HEAD']);
      const remoteUrlRaw = await git.remote(['get-url', 'origin']).catch(() => '');

      return {
        isRepository: true,
        branch: branchRaw.trim(),
        commit: commitRaw.trim(),
        remoteUrl: String(remoteUrlRaw ?? '').trim() || undefined,
        isDirty: !status.isClean(),
      };
    } catch {
      return { isRepository: false, isDirty: false };
    }
  }

  async checkout(directory: string, versionOrHash: string) {
    await simpleGit(directory).checkout(versionOrHash);
  }

  async fetch(directory: string) {
    await simpleGit(directory).fetch();
  }
}
