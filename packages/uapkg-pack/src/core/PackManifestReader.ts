import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { z } from 'zod';
import type { PackManifest } from '../contracts/PackTypes.js';

const packManifestSchema = z.object({
  name: z.string().min(1),
  version: z
    .string()
    .min(1)
    .refine((v) => semver.valid(semver.clean(v)) !== null, {
      message: 'Invalid semver version',
    }),
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
      const pretty = z.prettifyError(validated.error);
      throw new Error(`[uapkg] Invalid manifest ${manifestPath}:\n${pretty}`);
    }

    return validated.data;
  }
}
