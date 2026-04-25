import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { safeJsonParse } from '@uapkg/common';
import {
  createPackageNotFoundDiagnostic,
  createSchemaInvalidDiagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import { type PackageRegistryManifest, PackageRegistryManifestSchema } from '@uapkg/registry-schema';
import { getRegistryRepoPath } from '../paths/RegistryPaths.js';

/**
 * Reads package manifests from the local cloned registry repo.
 *
 * Layout: `registry/packages/{first-letter}/{package-name}.json`
 */
export class RegistryPackageReader {
  constructor(private readonly shortId: string) {}

  /** Read and validate a package registry manifest. */
  async readPackageManifest(packageName: string): Promise<Result<PackageRegistryManifest>> {
    const bag = new DiagnosticBag();
    const filePath = this.resolveManifestPath(packageName);

    if (!existsSync(filePath)) {
      bag.add(createPackageNotFoundDiagnostic(packageName, this.shortId));
      return bag.toFailure();
    }

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      bag.addError('CACHE_READ_ERROR', `Failed to read ${filePath}: ${err}`, {
        cachePath: filePath,
        reason: String(err),
      });
      return bag.toFailure();
    }

    const parseResult = safeJsonParse<unknown>(raw, filePath);
    if (!parseResult.ok) {
      bag.mergeArray(parseResult.diagnostics);
      return bag.toFailure();
    }

    const validated = PackageRegistryManifestSchema.safeParse(parseResult.value);
    if (!validated.success) {
      const issues = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      bag.add(createSchemaInvalidDiagnostic(filePath, issues));
      return bag.toFailure();
    }

    return ok(validated.data);
  }

  private resolveManifestPath(packageName: string): string {
    const firstLetter = packageName.charAt(0).toLowerCase();
    return join(getRegistryRepoPath(this.shortId), 'packages', firstLetter, `${packageName}.json`);
  }
}
