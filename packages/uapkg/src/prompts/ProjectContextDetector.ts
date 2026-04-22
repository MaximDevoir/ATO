import fs from 'node:fs';
import * as path from 'node:path';
import type { ManifestKind } from '@uapkg/package-manifest-schema';

// ---------------------------------------------------------------------------
// ProjectContextDetector — sniffs the working directory for `.uproject` or
// `.uplugin` files to suggest a sensible manifest kind + name during `init`.
//
// Pure I/O utility — no mutation, no throws. Failure to read the directory
// falls back to a project-shaped suggestion using the directory basename.
// ---------------------------------------------------------------------------

export interface ProjectContextDetection {
  suggestedKind: ManifestKind;
  suggestedName: string;
}

export class ProjectContextDetector {
  public detect(cwd: string): ProjectContextDetection {
    const uplugin = this.findFirstFileWithExtension(cwd, '.uplugin');
    if (uplugin) {
      return { suggestedKind: 'plugin', suggestedName: path.parse(uplugin).name };
    }

    const uproject = this.findFirstFileWithExtension(cwd, '.uproject');
    if (uproject) {
      return { suggestedKind: 'project', suggestedName: path.parse(uproject).name };
    }

    return { suggestedKind: 'project', suggestedName: path.basename(cwd) };
  }

  private findFirstFileWithExtension(directory: string, extension: '.uplugin' | '.uproject'): string | undefined {
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
