import type { ConfigLayer, ConfigTraceEntry, ConfigValueWithOrigin, ResolvedConfig } from '../contracts/ConfigTypes.js';
import { ConfigMerger } from '../merge/ConfigMerger.js';
import { configSchema } from '../schema/configSchema.js';
import { getValueByPath } from '../schema/pathSchema.js';

export class ConfigResolver {
  constructor(private readonly merger = new ConfigMerger()) {}

  resolveAll(layers: ConfigLayer[]): ResolvedConfig {
    let merged: unknown = {};

    for (const layer of layers) {
      merged = this.merger.merge(merged, layer.values);
    }

    return configSchema.parse(merged);
  }

  resolvePath(layers: ConfigLayer[], pathToProperty: string) {
    const merged = this.resolveAll(layers);
    return getValueByPath(merged, pathToProperty);
  }

  getWithOrigin(layers: ConfigLayer[], pathToProperty: string): ConfigValueWithOrigin {
    let value: unknown = null;
    let source: ConfigLayer['source'] = 'default';
    let file: string | undefined;

    for (const layer of layers) {
      const layerValue = getValueByPath(layer.values, pathToProperty);
      if (layerValue !== null) {
        value = layerValue;
        source = layer.source;
        file = layer.file;
      }
    }

    return {
      value,
      source,
      file,
    };
  }

  trace(layers: ConfigLayer[], pathToProperty: string): ConfigTraceEntry[] {
    return layers.map((layer) => ({
      source: layer.source,
      file: layer.file,
      value: getValueByPath(layer.values, pathToProperty),
    }));
  }
}
