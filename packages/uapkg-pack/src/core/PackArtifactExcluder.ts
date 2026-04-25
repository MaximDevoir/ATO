import path from 'node:path';
import type { CollectedFile } from '../contracts/PackTypes.js';

/**
 * Computes generated artifact paths that should never be re-packed.
 */
export class PackArtifactExcluder {
  public collect(pluginRoot: string, archivePath: string, files: readonly CollectedFile[]): Set<string> {
    const excluded = new Set<string>();

    const outputRelative = this.toRelativeWithinRoot(pluginRoot, archivePath);
    if (outputRelative) {
      excluded.add(outputRelative);
      excluded.add(`${outputRelative}.integrity`);
    }

    for (const file of files) {
      if (!file.relativePath.endsWith('.integrity')) continue;
      excluded.add(file.relativePath);

      const paired = file.relativePath.slice(0, -'.integrity'.length);
      if (paired.length > 0) {
        excluded.add(paired);
      }
    }

    return excluded;
  }

  private toRelativeWithinRoot(root: string, target: string): string | null {
    const relative = path.relative(path.resolve(root), path.resolve(target));
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }
    return relative.split(path.sep).join('/');
  }
}
