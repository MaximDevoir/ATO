import type { ConfigLayer } from '../contracts/ConfigTypes.js';
import { ConfigFileRepository } from '../files/ConfigFileRepository.js';
import { ConfigPathResolver } from '../files/ConfigPathResolver.js';
import { getDefaultConfig } from '../schema/configSchema.js';

export class ConfigLayerBuilder {
  constructor(
    private readonly pathResolver = new ConfigPathResolver(),
    private readonly repository = new ConfigFileRepository(),
  ) {}

  build(cwd: string): ConfigLayer[] {
    const paths = this.pathResolver.resolve(cwd);

    const layers: ConfigLayer[] = [
      {
        source: 'default',
        values: getDefaultConfig() as unknown as Record<string, unknown>,
      },
      {
        source: 'global',
        file: paths.globalFile,
        values: this.readValues(paths.globalFile),
      },
    ];

    for (const intermediaryFile of paths.intermediaryFiles) {
      layers.push({
        source: 'intermediary',
        file: intermediaryFile,
        values: this.readValues(intermediaryFile),
      });
    }

    layers.push({
      source: 'local',
      file: paths.localFile,
      values: this.readValues(paths.localFile),
    });

    return layers;
  }

  private readValues(filePath: string): Record<string, unknown> {
    const result = this.repository.read(filePath);
    if (!result.ok) {
      // Gracefully degrade: skip this layer rather than halting
      return {};
    }
    return result.value.values;
  }
}
