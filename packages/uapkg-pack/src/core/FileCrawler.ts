import fs from 'node:fs';
import path from 'node:path';
import type { CollectedFile } from '../contracts/PackTypes';

export class FileCrawler {
  collect(pluginRoot: string) {
    const files: CollectedFile[] = [];
    const pluginRootReal = fs.realpathSync(pluginRoot);
    this.walk(pluginRoot, pluginRootReal, pluginRoot, files, new Set());
    return files;
  }

  private walk(
    absolutePath: string,
    pluginRootReal: string,
    pluginRoot: string,
    files: CollectedFile[],
    resolutionStack: Set<string>,
  ) {
    const stat = fs.lstatSync(absolutePath);

    if (stat.isSymbolicLink()) {
      const targetReal = fs.realpathSync(absolutePath);
      this.assertPathInRoot(targetReal, pluginRootReal, absolutePath);

      if (resolutionStack.has(targetReal)) {
        throw new Error(`[uapkg] Cyclic symlink detected at ${absolutePath}`);
      }

      const nextStack = new Set(resolutionStack);
      nextStack.add(targetReal);
      this.walkResolved(absolutePath, targetReal, pluginRootReal, pluginRoot, files, nextStack);
      return;
    }

    this.walkResolved(absolutePath, absolutePath, pluginRootReal, pluginRoot, files, resolutionStack);
  }

  private walkResolved(
    visiblePath: string,
    resolvedPath: string,
    pluginRootReal: string,
    pluginRoot: string,
    files: CollectedFile[],
    resolutionStack: Set<string>,
  ) {
    const stat = fs.statSync(resolvedPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolvedPath).sort();
      for (const entry of entries) {
        const childVisible = path.join(visiblePath, entry);
        this.walk(childVisible, pluginRootReal, pluginRoot, files, resolutionStack);
      }
      return;
    }

    if (!stat.isFile()) {
      return;
    }

    const relativePath = this.normalizeRelative(pluginRoot, visiblePath);
    if (!relativePath) {
      return;
    }

    files.push({
      absolutePath: resolvedPath,
      relativePath,
    });
  }

  private normalizeRelative(root: string, filePath: string) {
    const relative = path.relative(root, filePath);
    if (!relative || relative.startsWith('..')) {
      return null;
    }

    const normalized = relative.split(path.sep).join('/');
    if (normalized.includes('/./') || normalized.includes('../') || normalized.startsWith('./')) {
      throw new Error(`[uapkg] Invalid normalized path: ${normalized}`);
    }

    return normalized;
  }

  private assertPathInRoot(targetReal: string, pluginRootReal: string, visiblePath: string) {
    const relative = path.relative(pluginRootReal, targetReal);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`[uapkg] Symlink resolves outside plugin root: ${visiblePath}`);
    }
  }
}
