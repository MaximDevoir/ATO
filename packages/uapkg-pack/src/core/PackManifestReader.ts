import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PackManifest } from '../contracts/PackTypes.js';

const packManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

export class PackManifestReader {
  read(pluginRoot: string): PackManifest {
    const manifestPath = path.join(pluginRoot, 'uapkg.json');

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(`[uapkg] Failed to read ${manifestPath}: ${details}`);
    }

    const validated = packManifestSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `[uapkg] Invalid ${manifestPath}: ${validated.error.issues.map((issue) => issue.message).join('; ')}`,
      );
    }

    return validated.data;
  }
}
