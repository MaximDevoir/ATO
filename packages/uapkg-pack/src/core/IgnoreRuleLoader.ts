import fs from 'node:fs';
import path from 'node:path';

export interface IgnoreRule {
  filePath: string;
  ruleDirectory: string;
  pattern: string;
}

export class IgnoreRuleLoader {
  load(gitRoot: string, pluginRoot: string): IgnoreRule[] {
    const rules: IgnoreRule[] = [];
    const gitExcludePath = path.join(gitRoot, '.git', 'info', 'exclude');

    if (fs.existsSync(gitExcludePath)) {
      rules.push(...this.readRuleFile(gitExcludePath, gitRoot));
    }

    for (const directory of this.collectDirectories(gitRoot, pluginRoot)) {
      for (const fileName of ['.gitignore', '.uapkgignore']) {
        const filePath = path.join(directory, fileName);
        if (fs.existsSync(filePath)) {
          rules.push(...this.readRuleFile(filePath, directory));
        }
      }
    }

    return rules;
  }

  private collectDirectories(gitRoot: string, pluginRoot: string) {
    const directories: string[] = [];
    const gitRootResolved = path.resolve(gitRoot);
    const pluginRootResolved = path.resolve(pluginRoot);
    let current = gitRootResolved;

    while (true) {
      directories.push(current);
      if (current === pluginRootResolved) {
        break;
      }

      const relative = path.relative(current, pluginRootResolved);
      const nextSegment = relative.split(path.sep)[0];
      if (!nextSegment || nextSegment === '..') {
        break;
      }

      current = path.join(current, nextSegment);
    }

    this.collectSubdirectories(pluginRootResolved, directories);
    return directories;
  }

  private collectSubdirectories(directoryPath: string, directories: string[]) {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const subdirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directoryPath, entry.name))
      .sort((left, right) => left.localeCompare(right));

    for (const subdirectory of subdirectories) {
      directories.push(subdirectory);
      this.collectSubdirectories(subdirectory, directories);
    }
  }

  private readRuleFile(filePath: string, ruleDirectory: string) {
    const source = fs.readFileSync(filePath, 'utf8');
    return source
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)
      .filter((line) => !line.trimStart().startsWith('#'))
      .map((pattern) => ({
        filePath,
        ruleDirectory,
        pattern,
      }));
  }
}
