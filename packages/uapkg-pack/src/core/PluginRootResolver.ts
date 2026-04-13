import fs from 'node:fs';
import path from 'node:path';
import { createPluginRootNotFoundDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

export interface ResolvedRoots {
  cwd: string;
  pluginRoot: string;
  gitRoot: string;
}

export class PluginRootResolver {
  resolve(cwd: string): Result<ResolvedRoots> {
    const resolvedCwd = path.resolve(cwd);
    const pluginRoot = this.findNearestManifestRoot(resolvedCwd);
    if (!pluginRoot) {
      return fail([createPluginRootNotFoundDiagnostic(resolvedCwd)]);
    }

    return ok({
      cwd: resolvedCwd,
      pluginRoot,
      gitRoot: this.findGitRoot(pluginRoot) ?? pluginRoot,
    });
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
