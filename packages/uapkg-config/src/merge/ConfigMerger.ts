import type { ConfigLayer, ConfigResolvedResult } from '../contracts/ConfigTypes.js';
import { partialConfigSchema } from '../schema/configSchema.js';
import { ConfigSchemaMergeEngine } from './ConfigSchemaMergeEngine.js';

export class ConfigMerger {
  public constructor(private readonly engine = new ConfigSchemaMergeEngine(partialConfigSchema)) {}

  public mergeLayers(layers: readonly ConfigLayer[]): ConfigResolvedResult {
    return this.engine.mergeLayers(layers);
  }
}
