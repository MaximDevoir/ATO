import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeJsonParse } from '@uapkg/common';
import {
  createManifestInvalidDiagnostic,
  createManifestReadErrorDiagnostic,
  DiagnosticBag,
  type Result,
} from '@uapkg/diagnostics';
import { type Manifest, ManifestSchema } from '@uapkg/package-manifest-schema';

const MANIFEST_FILENAME = 'uapkg.json';

/**
 * Reads and validates `uapkg.json` from a given root directory.
 */
export class ManifestReader {
  /** Read and parse the manifest. */
  async read(manifestRoot: string): Promise<Result<Manifest>> {
    const bag = new DiagnosticBag();
    const filePath = join(manifestRoot, MANIFEST_FILENAME);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      bag.add(createManifestReadErrorDiagnostic(filePath, String(err)));
      return bag.toFailure();
    }

    const parseResult = safeJsonParse<unknown>(raw, filePath);
    if (!parseResult.ok) {
      bag.mergeArray(parseResult.diagnostics);
      return bag.toFailure();
    }

    const validated = ManifestSchema.safeParse(parseResult.value);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      bag.add(createManifestInvalidDiagnostic(filePath, issues));
      return bag.toFailure();
    }

    return bag.toResult(validated.data);
  }
}
