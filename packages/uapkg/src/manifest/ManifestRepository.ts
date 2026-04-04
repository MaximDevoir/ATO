import fs from 'node:fs';
import * as path from 'node:path';
import type { z } from 'zod';
import { type UAPKGManifest, UAPKGManifestSchema } from '../domain/UAPKGManifest';

export interface ManifestRepository {
  getManifestPath(cwd: string): string;
  exists(cwd: string): boolean;
  read(cwd: string): UAPKGManifest;
  write(cwd: string, manifest: UAPKGManifest): void;
}

export class FileManifestRepository implements ManifestRepository {
  getManifestPath(cwd: string) {
    return path.join(cwd, 'uapkg.json');
  }

  exists(cwd: string) {
    return fs.existsSync(this.getManifestPath(cwd));
  }

  read(cwd: string) {
    const manifestPath = this.getManifestPath(cwd);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      throw new Error(
        `[uapkg] Failed to read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const validated = UAPKGManifestSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `[uapkg] Invalid ${manifestPath}: ${validated.error.issues.map((issue: z.ZodIssue) => issue.message).join('; ')}`,
      );
    }

    return validated.data;
  }

  write(cwd: string, manifest: UAPKGManifest) {
    const manifestPath = this.getManifestPath(cwd);
    const validated = UAPKGManifestSchema.parse(manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf-8');
  }
}
