import type { ConfigLayer } from '../contracts/ConfigTypes';
import { ConfigFileRepository } from '../files/ConfigFileRepository';
import { ConfigPathResolver } from '../files/ConfigPathResolver';
import { getDefaultConfig } from '../schema/configSchema';

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
        values: this.repository.read(paths.globalFile).values,
      },
    ];

    for (const intermediaryFile of paths.intermediaryFiles) {
      layers.push({
        source: 'intermediary',
        file: intermediaryFile,
        values: this.repository.read(intermediaryFile).values,
      });
    }

    layers.push({
      source: 'local',
      file: paths.localFile,
      values: this.repository.read(paths.localFile).values,
    });

    return layers;
  }
}
