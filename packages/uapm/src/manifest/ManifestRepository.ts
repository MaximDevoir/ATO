import fs from 'node:fs';
import * as path from 'node:path';
import type { z } from 'zod';
import { type UAPMManifest, UAPMManifestSchema } from '../domain/UAPMManifest';

export interface ManifestRepository {
  getManifestPath(cwd: string): string;
  exists(cwd: string): boolean;
  read(cwd: string): UAPMManifest;
  write(cwd: string, manifest: UAPMManifest): void;
}

export class FileManifestRepository implements ManifestRepository {
  getManifestPath(cwd: string) {
    return path.join(cwd, 'uapm.json');
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
        `[uapm] Failed to read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const validated = UAPMManifestSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `[uapm] Invalid ${manifestPath}: ${validated.error.issues.map((issue: z.ZodIssue) => issue.message).join('; ')}`,
      );
    }

    return validated.data;
  }

  write(cwd: string, manifest: UAPMManifest) {
    const manifestPath = this.getManifestPath(cwd);
    const validated = UAPMManifestSchema.parse(manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf-8');
  }
}
