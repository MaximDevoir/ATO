import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createGitErrorDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { RegistryDescriptor } from '../contracts/RegistryCoreTypes.js';
import { getRegistryRepoPath } from '../paths/RegistryPaths.js';

const execFileAsync = promisify(execFile);

/**
 * Handles git clone and git fetch/pull for a single registry.
 */
export class RegistryUpdater {
  constructor(
    private readonly shortId: string,
    private readonly descriptor: RegistryDescriptor,
    private readonly gitBinary: string,
  ) {}

  /** Clone or fetch the registry repo as needed. */
  async update(): Promise<Result<void>> {
    const bag = new DiagnosticBag();
    const repoPath = getRegistryRepoPath(this.shortId);

    if (!existsSync(repoPath)) {
      const initResult = await this.cloneRepo(repoPath);
      if (!initResult.ok) {
        bag.mergeArray(initResult.diagnostics);
        return bag.toFailure();
      }
    } else {
      const fetchResult = await this.fetchRepo(repoPath);
      if (!fetchResult.ok) {
        bag.mergeArray(fetchResult.diagnostics);
        return bag.toFailure();
      }
    }

    return bag.toResult(undefined);
  }

  private async cloneRepo(repoPath: string): Promise<Result<void>> {
    const parentDir = repoPath.replace(/[/\\][^/\\]+$/, '');
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }

    const args = ['clone', '--single-branch'];
    if (this.descriptor.ref.type === 'branch') {
      args.push('--branch', this.descriptor.ref.value);
    }
    args.push(this.descriptor.url, repoPath);

    return this.runGit(args);
  }

  private async fetchRepo(repoPath: string): Promise<Result<void>> {
    const fetchResult = await this.runGit(['fetch', 'origin'], repoPath);
    if (!fetchResult.ok) return fetchResult;

    const ref = this.resolveRefSpec();
    return this.runGit(['reset', '--hard', ref], repoPath);
  }

  private resolveRefSpec(): string {
    switch (this.descriptor.ref.type) {
      case 'branch':
        return `origin/${this.descriptor.ref.value}`;
      case 'tag':
        return `tags/${this.descriptor.ref.value}`;
      case 'rev':
        return this.descriptor.ref.value;
    }
  }

  private async runGit(args: string[], cwd?: string): Promise<Result<void>> {
    try {
      await execFileAsync(this.gitBinary, args, { cwd, timeout: 120_000 });
      return ok(undefined);
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr ?? String(err);
      const exitCode = (err as { code?: number }).code ?? 1;
      return {
        ok: false,
        diagnostics: [createGitErrorDiagnostic(`${this.gitBinary} ${args.join(' ')}`, stderr, exitCode)],
      };
    }
  }
}
