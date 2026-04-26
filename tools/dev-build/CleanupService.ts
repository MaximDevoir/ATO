import fs from 'node:fs';
import path from 'node:path';
import type { ProcessRunner } from './ProcessRunner';

export class CleanupService {
  constructor(
    private readonly runner: ProcessRunner,
    private readonly workspaceRoot: string,
  ) {}

  cleanBuildArtifacts() {
    for (const rootTarget of this.getRootBuildTargets()) {
      this.removeDirectoryIfExists(rootTarget);
    }

    for (const packageDir of this.getWorkspacePackageDirectories()) {
      for (const targetName of ['dist', 'build', 'coverage', '.turbo', '.cache']) {
        this.removeDirectoryIfExists(path.join(packageDir, targetName));
      }

      this.removeFilesBySuffix(packageDir, '.tsbuildinfo');
    }

    this.removeFilesBySuffix(path.join(this.workspaceRoot, 'tools'), '.tsbuildinfo');
    this.runner.runAndCapture('pnpm', ['nx', 'reset'], this.workspaceRoot, { ignoreFailure: true });
  }

  cleanAll() {
    this.cleanBuildArtifacts();
    this.removeWorkspaceNodeModules();
    this.removeWorkspacePnpmStores();
    this.runner.runAndCapture('pnpm', ['store', 'prune'], this.workspaceRoot, { ignoreFailure: true });
  }

  private getRootBuildTargets() {
    return [
      path.join(this.workspaceRoot, 'coverage'),
      path.join(this.workspaceRoot, 'dist'),
      path.join(this.workspaceRoot, 'build'),
      path.join(this.workspaceRoot, '.turbo'),
      path.join(this.workspaceRoot, '.nx', 'cache'),
      path.join(this.workspaceRoot, '.nx', 'workspace-data'),
    ];
  }

  private getWorkspacePackageDirectories() {
    const packagesRoot = path.join(this.workspaceRoot, 'packages');
    if (!fs.existsSync(packagesRoot)) {
      return [];
    }

    const directories: string[] = [];
    for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      directories.push(path.join(packagesRoot, entry.name));
    }

    return directories;
  }

  private removeWorkspaceNodeModules() {
    this.removeDirectoryIfExists(path.join(this.workspaceRoot, 'node_modules'));

    for (const packageDir of this.getWorkspacePackageDirectories()) {
      this.removeDirectoryIfExists(path.join(packageDir, 'node_modules'));
    }

    const toolsRoot = path.join(this.workspaceRoot, 'tools');
    if (!fs.existsSync(toolsRoot)) {
      return;
    }

    for (const toolDir of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
      if (!toolDir.isDirectory()) {
        continue;
      }

      this.removeDirectoryIfExists(path.join(toolsRoot, toolDir.name, 'node_modules'));
    }
  }

  private removeWorkspacePnpmStores() {
    this.removeDirectoryIfExists(path.join(this.workspaceRoot, '.pnpm-store'));

    for (const packageDir of this.getWorkspacePackageDirectories()) {
      this.removeDirectoryIfExists(path.join(packageDir, '.pnpm-store'));
    }

    const toolsRoot = path.join(this.workspaceRoot, 'tools');
    if (!fs.existsSync(toolsRoot)) {
      return;
    }

    for (const toolDir of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
      if (!toolDir.isDirectory()) {
        continue;
      }

      this.removeDirectoryIfExists(path.join(toolsRoot, toolDir.name, '.pnpm-store'));
    }
  }

  private removeFilesBySuffix(rootDir: string, suffix: string) {
    if (!fs.existsSync(rootDir)) {
      return;
    }

    const stack = [rootDir];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) {
        continue;
      }

      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          this.enqueueDirectoryForScan(entry.name, fullPath, stack);
          continue;
        }

        this.removeFileBySuffixIfMatch(entry.name, fullPath, suffix);
      }
    }
  }

  private enqueueDirectoryForScan(entryName: string, fullPath: string, stack: string[]) {
    if (entryName === 'node_modules') {
      return;
    }

    stack.push(fullPath);
  }

  private removeFileBySuffixIfMatch(entryName: string, fullPath: string, suffix: string) {
    if (!entryName.endsWith(suffix)) {
      return;
    }

    try {
      fs.rmSync(fullPath, { force: true });
    } catch (error) {
      this.printCleanupWarning(fullPath, error);
    }
  }

  private removeDirectoryIfExists(targetDir: string) {
    if (!fs.existsSync(targetDir)) {
      return;
    }

    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch (error) {
      this.printCleanupWarning(targetDir, error);
    }
  }

  private printCleanupWarning(targetPath: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[dev-build] Cleanup warning for ${targetPath}: ${message}`);
  }
}
