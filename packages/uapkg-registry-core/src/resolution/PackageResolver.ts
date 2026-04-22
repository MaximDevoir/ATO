import type { PackageVersion, VersionRange } from '@uapkg/common-schema';
import { createVersionNotFoundDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { PackageRegistryManifest, RegistryVersion } from '@uapkg/registry-schema';
import { SemverSelectionPolicy } from './SemverSelectionPolicy.js';

export interface ResolvedVersion {
  readonly version: string;
  readonly entry: RegistryVersion;
}

const defaultPolicy = new SemverSelectionPolicy();

/**
 * Resolve the best version from a registry manifest that satisfies a range.
 *
 * Uses {@link SemverSelectionPolicy} so that:
 *  - Stable ranges never auto-jump into prereleases.
 *  - Users already on a prerelease escape to a satisfying stable version
 *    as soon as one is published.
 *
 * @param current Optional currently-installed version, used to bias
 *   escape-from-prerelease selection.
 */
export function resolveVersion(
  manifest: PackageRegistryManifest,
  versionRange: string,
  registryName: string,
  current?: string,
): Result<ResolvedVersion> {
  const bag = new DiagnosticBag();
  const availableVersions = Object.keys(manifest.versions) as PackageVersion[];

  const best = defaultPolicy.selectBest(
    availableVersions,
    versionRange as unknown as VersionRange,
    current as unknown as PackageVersion | undefined,
  );
  if (best === null) {
    bag.add(
      createVersionNotFoundDiagnostic(
        manifest.name,
        versionRange,
        registryName,
        availableVersions as unknown as string[],
      ),
    );
    return bag.toFailure();
  }

  const entry = (manifest.versions as Record<string, RegistryVersion>)[best as unknown as string];
  return ok({ version: best as unknown as string, entry });
}
