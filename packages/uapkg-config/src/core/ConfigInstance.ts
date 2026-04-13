import type { Result } from '@uapkg/diagnostics';
import type {
  ConfigCreateOptions,
  ConfigGetOptions,
  ConfigListOptions,
  ConfigReloadOptions,
  ConfigTraceEntry,
  ConfigValueWithOrigin,
  ConfigWriteOptions,
  ResolvedConfig,
} from '../contracts/ConfigTypes.js';
import { validateConfigPath } from '../schema/pathSchema.js';
import { ConfigLayerBuilder } from './ConfigLayerBuilder.js';
import { ConfigResolver } from './ConfigResolver.js';
import { ConfigWriter } from './ConfigWriter.js';

export class ConfigInstance {
  private cwd: string;
  private layers = [] as ReturnType<ConfigLayerBuilder['build']>;

  constructor(
    options: ConfigCreateOptions = {},
    private readonly layerBuilder = new ConfigLayerBuilder(),
    private readonly resolver = new ConfigResolver(),
    private readonly writer = new ConfigWriter(),
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.reload({ cwd: this.cwd });
  }

  get(pathToProperty?: string, options: ConfigGetOptions = {}) {
    if (options.scope) {
      if (!pathToProperty) {
        const rawResult = this.writer.getRaw(this.cwd, options);
        if (!rawResult.ok) return null;
        return rawResult.value;
      }

      const pathResult = validateConfigPath(pathToProperty);
      if (!pathResult.ok) return null;

      const scopedResult = this.writer.getRaw(this.cwd, options);
      if (!scopedResult.ok) return null;
      if (scopedResult.value === null) return null;

      return this.getValueFromObject(scopedResult.value, pathToProperty);
    }

    if (!pathToProperty) {
      return this.getAll();
    }

    const pathResult = validateConfigPath(pathToProperty);
    if (!pathResult.ok) return null;

    return this.resolver.resolvePath(this.layers, pathToProperty);
  }

  getAll(options: ConfigListOptions = {}): ResolvedConfig | Record<string, unknown> | null {
    if (options.scope) {
      const result = this.writer.listRaw(this.cwd, options);
      if (!result.ok) return null;
      return result.value;
    }

    return this.resolver.resolveAll(this.layers);
  }

  getDefaultRegistry() {
    const config = this.getAll() as ResolvedConfig;
    const selected = config.registry;
    return config.registries[selected] ?? null;
  }

  getWithOrigin(pathToProperty: string): ConfigValueWithOrigin | null {
    const pathResult = validateConfigPath(pathToProperty);
    if (!pathResult.ok) return null;
    return this.resolver.getWithOrigin(this.layers, pathToProperty);
  }

  trace(pathToProperty: string): ConfigTraceEntry[] {
    const pathResult = validateConfigPath(pathToProperty);
    if (!pathResult.ok) return [];
    return this.resolver.trace(this.layers, pathToProperty);
  }

  set(
    pathToProperty: string,
    value: unknown,
    options: ConfigWriteOptions = {},
  ): Result<{ file: string; values: Record<string, unknown> }> {
    return this.writer.prepareSet(this.cwd, pathToProperty, value, options);
  }

  delete(
    pathToProperty: string,
    options: ConfigWriteOptions = {},
  ): Result<{ file: string; values: Record<string, unknown> }> {
    return this.writer.prepareDelete(this.cwd, pathToProperty, options);
  }

  getEditTarget(options: ConfigWriteOptions = {}) {
    return this.writer.getEditTarget(this.cwd, options.scope);
  }

  toDisplayPath(filePath: string) {
    return this.writer.toDisplayPath(this.cwd, filePath);
  }

  reload(options: ConfigReloadOptions = {}) {
    this.cwd = options.cwd ?? this.cwd;
    this.layers = this.layerBuilder.build(this.cwd);
    return this;
  }

  private getValueFromObject(data: unknown, pathToProperty: string) {
    const segments = pathToProperty.split('.');
    let current = data;

    for (const segment of segments) {
      if (typeof current !== 'object' || current === null || Array.isArray(current) || !(segment in current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
