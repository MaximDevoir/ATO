import fs from 'node:fs';
import path from 'node:path';

export interface ResolvedRoots {
  cwd: string;
  pluginRoot: string;
  gitRoot: string;
}

export class PluginRootResolver {
  resolve(cwd: string): ResolvedRoots {
    const resolvedCwd = path.resolve(cwd);
    const pluginRoot = this.findNearestManifestRoot(resolvedCwd);
    if (!pluginRoot) {
      throw new Error('[uapkg] No uapkg.json found from current directory upward');
    }

    return {
      cwd: resolvedCwd,
      pluginRoot,
      gitRoot: this.findGitRoot(pluginRoot) ?? pluginRoot,
    };
  }

  private findNearestManifestRoot(start: string) {
    let current = start;

    while (true) {
      if (fs.existsSync(path.join(current, 'uapkg.json'))) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }

      current = parent;
    }
  }

  private findGitRoot(start: string) {
    let current = start;

    while (true) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }

      current = parent;
    }
  }
}
