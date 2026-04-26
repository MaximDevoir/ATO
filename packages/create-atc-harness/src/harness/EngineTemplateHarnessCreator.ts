import * as path from 'node:path';
import type { HarnessCreationResult } from '../domain/HarnessCreationResult.js';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings.js';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle.js';
import type { FileSystem } from '../services/FileSystem.js';
import type { HarnessCreator } from './HarnessCreator.js';

const ENGINE_TEMPLATE_NAMES = new Set(['EngineTemplate', 'engine-template', 'template']);

export class EngineTemplateHarnessCreator implements HarnessCreator {
  readonly name = 'EngineTemplate';

  constructor(private readonly fileSystem: FileSystem) {}

  canAcceptHarness(harnessString: string) {
    return ENGINE_TEMPLATE_NAMES.has(harnessString.trim());
  }

  async executeHarnessCreation(
    settings: HarnessCreationSettings,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ) {
    const projectName = path.basename(settings.rootFolder);
    const projectFilePath = path.join(settings.rootFolder, `${projectName}.uproject`);
    const projectPayload = {
      FileVersion: 3,
      EngineAssociation: settings.engineAssociation ?? '',
      Category: '',
      Description: 'ATC Harness Project',
      Modules: [],
      Plugins: [],
    };

    liveStatus.setStatus('[Harness/EngineTemplate] Creating baseline Unreal project structure');
    this.fileSystem.ensureDirectory(settings.rootFolder);
    this.fileSystem.ensureDirectory(path.join(settings.rootFolder, 'Config'));
    this.fileSystem.ensureDirectory(path.join(settings.rootFolder, 'Content'));
    this.fileSystem.ensureDirectory(path.join(settings.rootFolder, 'Plugins'));
    this.fileSystem.ensureDirectory(path.join(settings.rootFolder, 'Source'));

    // Write the minimal host project descriptor expected by Unreal.
    this.fileSystem.ensureDirectory(path.dirname(projectFilePath));
    this.fileSystem.writeText(projectFilePath, `${JSON.stringify(projectPayload, null, 2)}\n`);

    result.addLog(`[Harness/EngineTemplate] Created ${projectFilePath}`);
  }
}
