import { createVersionNotFoundDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { PackageRegistryManifest, RegistryVersion } from '@uapkg/registry-schema';
import { maxSatisfying } from 'semver';

export interface ResolvedVersion {
  readonly version: string;
  readonly entry: RegistryVersion;
}

/**
 * Resolve the best version from a registry manifest that satisfies a range.
 */
export function resolveVersion(
  manifest: PackageRegistryManifest,
  versionRange: string,
  registryName: string,
): Result<ResolvedVersion> {
  const bag = new DiagnosticBag();
  const availableVersions = Object.keys(manifest.versions);

  const best = maxSatisfying(availableVersions, versionRange);
  if (best === null) {
    bag.add(createVersionNotFoundDiagnostic(manifest.name, versionRange, registryName, availableVersions));
    return bag.toFailure();
  }

  const entry = (manifest.versions as Record<string, RegistryVersion>)[best];
  return ok({ version: best, entry });
}
