import { DiagnosticBag } from '@uapkg/diagnostics';
import type { ConfigLayer, ConfigLayerBuildResult } from '../contracts/ConfigTypes.js';
import { ConfigFileRepository } from '../files/ConfigFileRepository.js';
import { ConfigPathResolver } from '../files/ConfigPathResolver.js';
import { getDefaultConfig } from '../schema/configSchema.js';

export class ConfigLayerBuilder {
  constructor(
    private readonly pathResolver = new ConfigPathResolver(),
    private readonly repository = new ConfigFileRepository(),
  ) {}

  build(cwd: string): ConfigLayerBuildResult {
    const paths = this.pathResolver.resolve(cwd);
    const bag = new DiagnosticBag();

    const layers: ConfigLayer[] = [
      {
        source: 'default',
        values: getDefaultConfig() as unknown as Record<string, unknown>,
      },
      {
        source: 'global',
        file: paths.globalFile,
        values: this.readValues(paths.globalFile, bag),
      },
    ];

    for (const intermediaryFile of paths.intermediaryFiles) {
      layers.push({
        source: 'intermediary',
        file: intermediaryFile,
        values: this.readValues(intermediaryFile, bag),
      });
    }

    layers.push({
      source: 'local',
      file: paths.localFile,
      values: this.readValues(paths.localFile, bag),
    });

    return { layers, diagnostics: bag.all() };
  }

  private readValues(filePath: string, bag: DiagnosticBag): Record<string, unknown> {
    const result = this.repository.read(filePath);
    if (!result.ok) {
      bag.mergeArray(result.diagnostics);
      return {};
    }
    bag.mergeArray(result.value.diagnostics);
    return result.value.values;
  }
}
