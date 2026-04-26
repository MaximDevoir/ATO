import * as path from 'node:path';
import type { CommandLineOptions } from './CommandLineOptions.js';

export interface HarnessCreationSettingsInit {
  rootFolder: string;
  pluginManifestFolder: string;
  harnessString: string;
  commandLineOptions: CommandLineOptions;
  engineDirectory?: string;
  engineAssociation?: string;
}

export class HarnessCreationSettings {
  readonly rootFolder: string;
  readonly pluginManifestFolder: string;
  readonly harnessString: string;
  readonly commandLineOptions: CommandLineOptions;
  readonly engineDirectory?: string;
  readonly engineAssociation?: string;

  constructor(init: HarnessCreationSettingsInit) {
    this.rootFolder = path.resolve(init.rootFolder);
    this.pluginManifestFolder = path.resolve(init.pluginManifestFolder);
    this.harnessString = init.harnessString;
    this.commandLineOptions = init.commandLineOptions;
    this.engineDirectory = init.engineDirectory;
    this.engineAssociation = init.engineAssociation;
  }

  getPluginManifestFile() {
    return path.join(this.pluginManifestFolder, 'uapkg.json');
  }

  getHarnessPluginsDirectory() {
    return path.join(this.rootFolder, 'Plugins');
  }
}
