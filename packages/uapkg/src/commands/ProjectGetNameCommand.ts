import type { ManifestRepository } from '../manifest/ManifestRepository.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import type { Command } from './Command.js';

export interface ProjectGetNameCommandOptions {
  cwd: string;
}

export class ProjectGetNameCommand implements Command {
  constructor(
    private readonly options: ProjectGetNameCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly reporter: Reporter,
  ) {}

  async execute() {
    if (!this.manifestRepository.exists(this.options.cwd)) {
      throw new Error('[uapkg] No uapkg.json found in current directory');
    }

    const manifest = this.manifestRepository.read(this.options.cwd);
    if (manifest.type !== 'project') {
      throw new Error(`[uapkg] Expected manifest type 'project', received '${manifest.type}'`);
    }

    this.reporter.info(manifest.name);
    return 0;
  }
}
