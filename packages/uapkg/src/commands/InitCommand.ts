import type { ManifestType, UAPKGManifest } from '../domain/UAPKGManifest.js';
import type { ManifestRepository } from '../manifest/ManifestRepository.js';
import type { ProjectContextDetector } from '../services/ProjectContextDetector.js';
import type { Reporter } from '../ui/ConsoleReporter.js';
import type { PromptService } from '../ui/PromptService.js';
import type { Command } from './Command.js';

export interface InitCommandOptions {
  cwd: string;
  explicitType?: ManifestType;
  explicitName?: string;
}

export class InitCommand implements Command {
  constructor(
    private readonly options: InitCommandOptions,
    private readonly manifestRepository: ManifestRepository,
    private readonly detector: ProjectContextDetector,
    private readonly promptService: PromptService,
    private readonly reporter: Reporter,
  ) {}

  async execute() {
    if (this.manifestRepository.exists(this.options.cwd)) {
      throw new Error('[uapkg] uapkg.json already exists in current directory');
    }

    const detected = this.detector.detect(this.options.cwd);
    const selectedType = this.options.explicitType
      ? this.options.explicitType
      : ((await this.promptService.select(
          'Select manifest type',
          [
            { label: 'Project', value: 'project' },
            { label: 'Plugin', value: 'plugin' },
          ],
          detected.suggestedType,
        )) as ManifestType);

    const name = this.options.explicitName
      ? this.options.explicitName
      : await this.promptService.text('Package name', detected.suggestedName);

    const manifest: UAPKGManifest = {
      name: name.trim(),
      type: selectedType,
      dependencies: [],
    };

    this.manifestRepository.write(this.options.cwd, manifest);
    this.reporter.info(`[uapkg] Created uapkg.json (${selectedType}) for ${manifest.name}`);
    return 0;
  }
}
