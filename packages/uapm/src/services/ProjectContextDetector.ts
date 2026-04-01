import fs from 'node:fs';
import * as path from 'node:path';
import type { ManifestType } from '../domain/UAPMManifest';

export interface ProjectContextDetection {
  suggestedType: ManifestType;
  suggestedName: string;
}

export class ProjectContextDetector {
  detect(cwd: string): ProjectContextDetection {
    const uplugin = this.findFirstFileWithExtension(cwd, '.uplugin');
    if (uplugin) {
      return {
        suggestedType: 'plugin',
        suggestedName: path.parse(uplugin).name,
      };
    }

    const uproject = this.findFirstFileWithExtension(cwd, '.uproject');
    if (uproject) {
      return {
        suggestedType: 'project',
        suggestedName: path.parse(uproject).name,
      };
    }

    return {
      suggestedType: 'harness',
      suggestedName: path.basename(cwd),
    };
  }

  private findFirstFileWithExtension(directory: string, extension: '.uplugin' | '.uproject') {
    try {
      return fs
        .readdirSync(directory)
        .find((entry) => entry.toLowerCase().endsWith(extension))
        ?.toString();
    } catch {
      return undefined;
    }
  }
}
