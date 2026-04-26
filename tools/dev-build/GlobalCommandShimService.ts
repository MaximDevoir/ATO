import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PathUtils } from './PathUtils';
import type { ProcessRunner } from './ProcessRunner';

interface GlobalShimPaths {
  cmdPath: string;
  shPath: string;
}

export class GlobalCommandShimService {
  private readonly pathUtils: PathUtils;

  constructor(
    private readonly runner: ProcessRunner,
    private readonly workspaceRoot: string,
  ) {
    this.pathUtils = new PathUtils();
  }

  getGlobalBinDir() {
    const result = this.runner.runAndCapture('pnpm', ['bin', '--global'], this.workspaceRoot, { ignoreFailure: true });
    const value = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    return value ?? null;
  }

  isGlobalBinOnPath(globalBinDir: string) {
    const pathEntries = (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return pathEntries.some((entry) => this.pathUtils.isSamePath(entry, globalBinDir));
  }

  ensureWorkspaceGlobalShims() {
    const globalBinDir = this.getGlobalBinDir();
    if (!globalBinDir) {
      return null;
    }

    fs.mkdirSync(globalBinDir, { recursive: true });
    const shimPaths = this.getShimPaths(globalBinDir);
    const cliEntry = this.getWorkspaceCliEntryPath();

    fs.writeFileSync(shimPaths.cmdPath, this.renderWindowsShim(cliEntry), 'utf8');
    fs.writeFileSync(shimPaths.shPath, this.renderPosixShim(cliEntry), 'utf8');

    try {
      fs.chmodSync(shimPaths.shPath, 0o755);
    } catch {
      // No-op for platforms where chmod is not applicable.
    }

    return {
      globalBinDir,
      activeShimPath: process.platform === 'win32' ? shimPaths.cmdPath : shimPaths.shPath,
    };
  }

  removeWorkspaceGlobalShims() {
    const globalBinDir = this.getGlobalBinDir();
    if (!globalBinDir) {
      return;
    }

    const cliEntry = this.getWorkspaceCliEntryPath();
    const shimPaths = this.getShimPaths(globalBinDir);
    this.removeFileIfOwned(shimPaths.cmdPath, cliEntry);
    this.removeFileIfOwned(shimPaths.shPath, cliEntry);
  }

  resolveWorkspaceShimPath() {
    const globalBinDir = this.getGlobalBinDir();
    if (!globalBinDir) {
      return null;
    }

    const shimPaths = this.getShimPaths(globalBinDir);
    if (process.platform === 'win32') {
      if (fs.existsSync(shimPaths.cmdPath)) {
        return shimPaths.cmdPath;
      }

      return null;
    }

    if (fs.existsSync(shimPaths.shPath)) {
      return shimPaths.shPath;
    }

    return null;
  }

  resolveBinaryFromPath() {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const result = this.runner.runAndCapture(command, ['uapkg'], os.homedir(), { ignoreFailure: true });
    const firstLine = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    return firstLine ?? null;
  }

  cleanupLegacyWorkspaceRootShims() {
    const cmdPath = path.join(this.workspaceRoot, 'uapkg.cmd');
    const shPath = path.join(this.workspaceRoot, 'uapkg');

    const legacyCmdSnippet = 'packages\\uapkg\\dist\\cli.js';
    const legacyShSnippet = 'packages/uapkg/dist/cli.js';

    this.removeFileIfContains(cmdPath, legacyCmdSnippet);
    this.removeFileIfContains(shPath, legacyShSnippet);
  }

  private getWorkspaceCliEntryPath() {
    return path.join(this.workspaceRoot, 'packages', 'uapkg', 'dist', 'cli.js');
  }

  private getShimPaths(globalBinDir: string): GlobalShimPaths {
    return {
      cmdPath: path.join(globalBinDir, 'uapkg.cmd'),
      shPath: path.join(globalBinDir, 'uapkg'),
    };
  }

  private removeFileIfOwned(filePath: string, cliEntryPath: string) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const contents = fs.readFileSync(filePath, 'utf8');
    const normalizedContents = contents.replaceAll('\\', '/').toLowerCase();
    const normalizedEntry = cliEntryPath.replaceAll('\\', '/').toLowerCase();
    if (!normalizedContents.includes(normalizedEntry)) {
      return;
    }

    fs.unlinkSync(filePath);
  }

  private removeFileIfContains(filePath: string, needle: string) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const contents = fs.readFileSync(filePath, 'utf8');
    if (!contents.includes(needle)) {
      return;
    }

    fs.unlinkSync(filePath);
  }

  private renderWindowsShim(cliEntryPath: string) {
    return `@echo off\r\nnode "${cliEntryPath}" %*\r\n`;
  }

  private renderPosixShim(cliEntryPath: string) {
    const normalizedEntry = cliEntryPath.replaceAll('\\', '/');
    return `#!/usr/bin/env sh\nnode "${normalizedEntry}" "$@"\n`;
  }
}
