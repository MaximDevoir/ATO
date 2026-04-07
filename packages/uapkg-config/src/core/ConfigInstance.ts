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
        return this.writer.getRaw(this.cwd, options);
      }

      validateConfigPath(pathToProperty);
      const scoped = this.writer.getRaw(this.cwd, options);
      if (scoped === null) {
        return null;
      }

      return this.getValueFromObject(scoped, pathToProperty);
    }

    if (!pathToProperty) {
      return this.getAll();
    }

    validateConfigPath(pathToProperty);
    return this.resolver.resolvePath(this.layers, pathToProperty);
  }

  getAll(options: ConfigListOptions = {}): ResolvedConfig | Record<string, unknown> | null {
    if (options.scope) {
      return this.writer.listRaw(this.cwd, options);
    }

    return this.resolver.resolveAll(this.layers);
  }

  getDefaultRegistry() {
    const config = this.getAll() as ResolvedConfig;
    const selected = config.registry;
    return config.registries[selected] ?? null;
  }

  getWithOrigin(pathToProperty: string): ConfigValueWithOrigin {
    validateConfigPath(pathToProperty);
    return this.resolver.getWithOrigin(this.layers, pathToProperty);
  }

  trace(pathToProperty: string): ConfigTraceEntry[] {
    validateConfigPath(pathToProperty);
    return this.resolver.trace(this.layers, pathToProperty);
  }

  set(pathToProperty: string, value: unknown, options: ConfigWriteOptions = {}) {
    return this.writer.prepareSet(this.cwd, pathToProperty, value, options);
  }

  delete(pathToProperty: string, options: ConfigWriteOptions = {}) {
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
