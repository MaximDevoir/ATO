import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeJsonParse } from '@uapkg/common';
import {
  createLockfileInvalidDiagnostic,
  createLockfileMissingDiagnostic,
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
  async readOptional(manifestRoot: string): Promise<Result<Lockfile | null>> {
    const bag = new DiagnosticBag();
    const filePath = join(manifestRoot, LOCKFILE_FILENAME);

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        bag.add(createLockfileMissingDiagnostic(filePath));
        return bag.toResult(null);
      }
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

  async readRequired(manifestRoot: string): Promise<Result<Lockfile>> {
    const bag = new DiagnosticBag();
    const filePath = join(manifestRoot, LOCKFILE_FILENAME);

    const optionalResult = await this.readOptional(manifestRoot);
    if (!optionalResult.ok) return optionalResult as Result<never>;
    if (optionalResult.value === null) {
      bag.add(createLockfileMissingDiagnostic(filePath, 'error'));
      return bag.toFailure();
    }

    bag.mergeArray(optionalResult.diagnostics);
    return bag.toResult(optionalResult.value);
  }
}
