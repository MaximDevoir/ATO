import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import type { AssetHash } from '@uapkg/common-schema';
import { createIntegrityMismatchDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';

/**
 * Verifies a downloaded file matches the expected `AssetHash`.
 *
 * The hash format is `"<algorithm>:<hex>"` (e.g. `"sha256:abc123…"`), matching
 * what the registry stores in `RegistryAsset.integrity.hash`.
 */
export class IntegrityVerifier {
  async verify(packageName: string, filePath: string, expected: AssetHash): Promise<Result<void>> {
    const bag = new DiagnosticBag();

    const parsed = this.parseHash(expected as unknown as string);
    if (!parsed) {
      bag.add(createIntegrityMismatchDiagnostic(packageName, expected as unknown as string, '(unparseable)'));
      return bag.toFailure();
    }

    const actual = await this.hashFile(filePath, parsed.algorithm);
    if (actual !== parsed.hex) {
      bag.add(
        createIntegrityMismatchDiagnostic(
          packageName,
          expected as unknown as string,
          `${parsed.algorithm}:${actual}`,
        ),
      );
      return bag.toFailure();
    }

    return ok(undefined);
  }

  private parseHash(raw: string): { readonly algorithm: string; readonly hex: string } | null {
    const i = raw.indexOf(':');
    if (i <= 0) return null;
    return { algorithm: raw.slice(0, i).toLowerCase(), hex: raw.slice(i + 1).toLowerCase() };
  }

  private hashFile(filePath: string, algorithm: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm);
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

