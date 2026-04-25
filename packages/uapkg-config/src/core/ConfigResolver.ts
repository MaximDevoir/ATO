import type { Diagnostic } from '@uapkg/diagnostics';
import type {
  ConfigLayer,
  ConfigResolvedResult,
  ConfigTraceEntry,
  ConfigValueWithOrigin,
} from '../contracts/ConfigTypes.js';
import { ConfigMerger } from '../merge/ConfigMerger.js';
import { getValueByPath } from '../schema/pathSchema.js';
import { ConfigSemanticValidator } from './ConfigSemanticValidator.js';

export class ConfigResolver {
  constructor(
    private readonly merger = new ConfigMerger(),
    private readonly semanticValidator = new ConfigSemanticValidator(),
  ) {}

  resolveAll(layers: ConfigLayer[]): ConfigResolvedResult {
    const merged = this.merger.mergeLayers(layers);
    const semanticDiagnostics = this.semanticValidator.validate(merged.value);
    return {
      value: merged.value,
      diagnostics: [...merged.diagnostics, ...semanticDiagnostics],
    };
  }

  resolvePath(layers: ConfigLayer[], pathToProperty: string): { value: unknown; diagnostics: readonly Diagnostic[] } {
    const resolved = this.resolveAll(layers);
    return {
      value: getValueByPath(resolved.value, pathToProperty),
      diagnostics: resolved.diagnostics,
    };
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
