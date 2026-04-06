import path from 'node:path';
import type { ConfigGetOptions, ConfigListOptions, ConfigScope, ConfigWriteOptions } from '../contracts/ConfigTypes';
import { ConfigFileRepository } from '../files/ConfigFileRepository';
import { ConfigPathResolver } from '../files/ConfigPathResolver';
import { partialConfigSchema } from '../schema/configSchema';
import { deleteValueByPath, setValueByPath, validateConfigPath } from '../schema/pathSchema';

export class ConfigWriter {
  constructor(
    private readonly pathResolver = new ConfigPathResolver(),
    private readonly repository = new ConfigFileRepository(),
  ) {}

  getRaw(cwd: string, options: ConfigGetOptions = {}) {
    if (options.scope === 'global') {
      const globalPath = this.pathResolver.resolve(cwd).globalFile;
      return this.repository.read(globalPath).values;
    }

    if (options.scope === 'local') {
      const localPath = this.pathResolver.findNearestLocalConfig(cwd);
      if (!localPath) {
        return null;
      }

      return this.repository.read(localPath).values;
    }

    throw new Error('[uapkg] Scope is required for getRaw');
  }

  listRaw(cwd: string, options: ConfigListOptions = {}) {
    return this.getRaw(cwd, { scope: options.scope });
  }

  prepareSet(cwd: string, pathToProperty: string, value: unknown, options: ConfigWriteOptions = {}) {
    validateConfigPath(pathToProperty);
    if (value === null) {
      throw new Error('[uapkg] null is not a valid config value');
    }

    const targetFile = this.resolveWriteTarget(cwd, options.scope);
    const existing = this.repository.read(targetFile).values;
    const cloned = structuredClone(existing);

    setValueByPath(cloned, pathToProperty, value);

    const validation = partialConfigSchema.safeParse(cloned);
    if (!validation.success) {
      throw new Error(
        `[uapkg] Invalid config value for ${pathToProperty}: ${validation.error.issues[0]?.message ?? 'unknown error'}`,
      );
    }

    return { file: targetFile, values: cloned };
  }

  prepareDelete(cwd: string, pathToProperty: string, options: ConfigWriteOptions = {}) {
    validateConfigPath(pathToProperty);

    const targetFile = this.resolveWriteTarget(cwd, options.scope);
    const existing = this.repository.read(targetFile).values;
    const cloned = structuredClone(existing);

    deleteValueByPath(cloned, pathToProperty);

    const validation = partialConfigSchema.safeParse(cloned);
    if (!validation.success) {
      throw new Error(
        `[uapkg] Invalid config after deleting ${pathToProperty}: ${validation.error.issues[0]?.message ?? 'unknown error'}`,
      );
    }

    return { file: targetFile, values: cloned };
  }

  getEditTarget(cwd: string, scope?: ConfigScope): string {
    if (scope === 'global') {
      return this.pathResolver.resolve(cwd).globalFile;
    }

    if (scope === 'local') {
      return this.pathResolver.resolveLocalWriteTarget(cwd);
    }

    const inferredScope: ConfigScope = this.pathResolver.isInProject(cwd) ? 'local' : 'global';
    return this.getEditTarget(cwd, inferredScope);
  }

  private resolveWriteTarget(cwd: string, scope?: ConfigScope) {
    if (scope === 'global') {
      return this.pathResolver.resolve(cwd).globalFile;
    }

    if (scope === 'local') {
      return this.pathResolver.resolveLocalWriteTarget(cwd);
    }

    return this.pathResolver.isInProject(cwd)
      ? this.pathResolver.resolveLocalWriteTarget(cwd)
      : this.pathResolver.resolve(cwd).globalFile;
  }

  toDisplayPath(cwd: string, filePath: string) {
    const relative = path.relative(path.resolve(cwd), filePath);
    return relative.startsWith('..') ? filePath : `.${path.sep}${relative}`;
  }
}
