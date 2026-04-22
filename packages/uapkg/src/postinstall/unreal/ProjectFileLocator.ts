import fs from 'node:fs';
import * as path from 'node:path';

/**
 * Pure-IO locator for Unreal build-tree anchors:
 *   * `*.Build.cs` files under `<projectRoot>/Source`
 *   * `*.Target.cs` files under `<projectRoot>/Source`
 *   * The single `*.uproject` at the project root.
 *
 * This module does no parsing; {@link UnrealSourceCatalog} pairs the returned
 * paths with a {@link CSharpStructureAnalyzer} to validate them.
 */
export class ProjectFileLocator {
  public findBuildFiles(projectRoot: string): string[] {
    return this.findBySuffix(path.join(projectRoot, 'Source'), '.Build.cs');
  }

  public findTargetFiles(projectRoot: string): string[] {
    return this.findBySuffix(path.join(projectRoot, 'Source'), '.Target.cs');
  }

  /**
   * Returns the single `.uproject` file at `projectRoot`, or throws if 0 or 2+
   * exist. Callers in the new subsystem catch and convert to diagnostics.
   */
  public findProjectFile(projectRoot: string): string {
    const entries = fs
      .readdirSync(projectRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.uproject'))
      .map((entry) => path.join(projectRoot, entry.name));
    if (entries.length !== 1) {
      throw new Error(`Expected exactly one .uproject in ${projectRoot}, found ${entries.length}`);
    }
    return entries[0];
  }

  private findBySuffix(root: string, suffix: string): string[] {
    if (!fs.existsSync(root)) return [];

    const files: string[] = [];
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (entry.isFile() && fullPath.endsWith(suffix)) files.push(fullPath);
      }
    }
    return files.sort((a, b) => a.localeCompare(b));
  }
}
