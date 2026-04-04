import fs from 'node:fs';
import * as path from 'node:path';

export class ProjectFileLocator {
  findBuildFiles(projectRoot: string) {
    return this.findBySuffix(path.join(projectRoot, 'Source'), '.Build.cs');
  }

  findTargetFiles(projectRoot: string) {
    return this.findBySuffix(path.join(projectRoot, 'Source'), '.Target.cs');
  }

  findProjectFile(projectRoot: string) {
    const entries = fs
      .readdirSync(projectRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.uproject'))
      .map((entry) => path.join(projectRoot, entry.name));
    if (entries.length !== 1) {
      throw new Error(`[uapkg] Expected exactly one .uproject in ${projectRoot}, found ${entries.length}`);
    }
    return entries[0];
  }

  private findBySuffix(root: string, suffix: string): string[] {
    if (!fs.existsSync(root)) {
      return [];
    }

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
        if (entry.isFile() && fullPath.endsWith(suffix)) {
          files.push(fullPath);
        }
      }
    }
    return files.sort((a, b) => a.localeCompare(b));
  }
}
