import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createSafetyOverriddenByForceDiagnostic,
  createSafetyTargetExistsNoManifestDiagnostic,
} from '@uapkg/diagnostics';
import type { SafetyContext, SafetyEvaluation, SafetyPolicy } from '../contracts/SafetyPolicyTypes.js';

/**
 * Policy: "target directory exists but contains no `uapkg.json`".
 *
 * Fail-safe behavior: if the install path already exists on disk but lacks
 * the marker manifest, we refuse to overwrite. `--force` downgrades to an
 * info diagnostic and allows the action.
 */
export class NoMarkerPolicy implements SafetyPolicy {
  readonly id = 'no-marker';

  async evaluate(context: SafetyContext): Promise<SafetyEvaluation> {
    const action = context.action;
    if (action.type !== 'add' && action.type !== 'update') return { kind: 'allow' };

    const target = resolve(context.manifestRoot, action.path);
    const exists = await this.dirExists(target);
    if (!exists) return { kind: 'allow' };

    const hasMarker = await this.fileExists(join(target, 'uapkg.json'));
    if (hasMarker) return { kind: 'allow' };

    if (context.force) {
      return {
        kind: 'warn',
        diagnostics: [createSafetyOverriddenByForceDiagnostic(action.packageName, this.id)],
      };
    }
    return {
      kind: 'block',
      diagnostics: [createSafetyTargetExistsNoManifestDiagnostic(action.packageName, action.path as unknown as string)],
    };
  }

  private async dirExists(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isFile();
    } catch {
      return false;
    }
  }
}

