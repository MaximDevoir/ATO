import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createManifestWriteErrorDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Manifest } from '@uapkg/package-manifest-schema';

const MANIFEST_FILENAME = 'uapkg.json';

/**
 * Writes `uapkg.json` to a given root directory.
 */
export class ManifestWriter {
  /** Serialize and write the manifest. */
  async write(manifestRoot: string, manifest: Manifest): Promise<Result<void>> {
    const bag = new DiagnosticBag();
    const filePath = join(manifestRoot, MANIFEST_FILENAME);

    try {
      if (!existsSync(manifestRoot)) {
        await mkdir(manifestRoot, { recursive: true });
      }
      await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
      return ok(undefined);
    } catch (err) {
      bag.add(createManifestWriteErrorDiagnostic(filePath, String(err)));
      return bag.toFailure();
    }
  }
}
