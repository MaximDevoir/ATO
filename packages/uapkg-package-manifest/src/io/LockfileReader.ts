import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeJsonParse } from '@uapkg/common';
import {
  createLockfileInvalidDiagnostic,
  createManifestReadErrorDiagnostic,
  DiagnosticBag,
  type Result,
} from '@uapkg/diagnostics';
import { type Lockfile, LockfileSchema } from '@uapkg/package-manifest-schema';

const LOCKFILE_FILENAME = 'uapkg.lock';

/**
 * Reads and validates `uapkg.lock` from a given root directory.
 */
export class LockfileReader {
  async read(manifestRoot: string): Promise<Result<Lockfile>> {
    const bag = new DiagnosticBag();
    const filePath = join(manifestRoot, LOCKFILE_FILENAME);

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

    const validated = LockfileSchema.safeParse(parseResult.value);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      bag.add(createLockfileInvalidDiagnostic(filePath, issues));
      return bag.toFailure();
    }

    return bag.toResult(validated.data);
  }
}
