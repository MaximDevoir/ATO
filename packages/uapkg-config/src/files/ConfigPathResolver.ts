import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ConfigPaths } from '../contracts/ConfigTypes.js';

export class ConfigPathResolver {
  resolve(cwd: string): ConfigPaths {
    const normalizedCwd = path.resolve(cwd);
    const manifestRoot = this.findManifestRoot(normalizedCwd) ?? normalizedCwd;

    return {
      cwd: normalizedCwd,
      manifestRoot,
      globalFile: path.join(os.homedir(), '.uapkg', 'config.json'),
      intermediaryFiles: this.findIntermediaryFiles(manifestRoot, normalizedCwd),
      localFile: path.join(normalizedCwd, '.uapkg', 'config.json'),
    };
  }

  private findManifestRoot(cwd: string) {
    let current = cwd;

    while (true) {
      const manifestPath = path.join(current, 'uapkg.json');
      if (fs.existsSync(manifestPath)) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }

      current = parent;
    }
  }

  private findIntermediaryFiles(manifestRoot: string, cwd: string) {
    if (manifestRoot === cwd) {
      return [];
    }

    const files: string[] = [];
    let current = manifestRoot;

    while (true) {
      const configPath = path.join(current, '.uapkg', 'config.json');
      if (fs.existsSync(configPath)) {
        files.push(configPath);
      }

      if (current === cwd) {
        break;
      }

      const relative = path.relative(current, cwd);
      const nextSegment = relative.split(path.sep)[0];
      if (!nextSegment || nextSegment === '..') {
        break;
      }

      current = path.join(current, nextSegment);
    }

    return files.filter((filePath) => filePath !== path.join(cwd, '.uapkg', 'config.json'));
  }

  findNearestLocalConfig(cwd: string) {
    const resolved = this.resolve(cwd);
    let current = resolved.cwd;

    while (true) {
      const configPath = path.join(current, '.uapkg', 'config.json');
      if (fs.existsSync(configPath)) {
        return configPath;
      }

      if (current === resolved.manifestRoot) {
        return null;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }

      current = parent;
    }
  }

  resolveLocalWriteTarget(cwd: string) {
    return this.findNearestLocalConfig(cwd) ?? path.join(path.resolve(cwd), '.uapkg', 'config.json');
  }

  isInProject(cwd: string) {
    return this.findManifestRoot(path.resolve(cwd)) !== null;
  }
}
