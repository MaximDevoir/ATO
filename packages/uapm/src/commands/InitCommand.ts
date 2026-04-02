import type { ManifestType, UAPMManifest } from '../domain/UAPMManifest';
import type { ManifestRepository } from '../manifest/ManifestRepository';
import type { ProjectContextDetector } from '../services/ProjectContextDetector';
import type { Reporter } from '../ui/ConsoleReporter';
import type { PromptService } from '../ui/PromptService';
import type { Command } from './Command';

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
      throw new Error('[uapm] uapm.json already exists in current directory');
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

    const manifest: UAPMManifest = {
      name: name.trim(),
      type: selectedType,
      dependencies: [],
    };

    this.manifestRepository.write(this.options.cwd, manifest);
    this.reporter.info(`[uapm] Created uapm.json (${selectedType}) for ${manifest.name}`);
    return 0;
  }
}
