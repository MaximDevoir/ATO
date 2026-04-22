import type { PackageName, PackageVersion, RegistryName } from '@uapkg/common-schema';
import { DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import { SemverSelectionPolicy } from '@uapkg/registry-core';

/**
 * Classification for a package in the `outdated` table.
 */
export type OutdatedStatus =
  | 'up-to-date' //  current === wanted === latest
  | 'outdated-range' //  current < wanted (wanted is newer within declared range)
  | 'outdated-latest' //  wanted === current but a newer version exists outside range
  | 'pinned'; //  the manifest pins this dep via `overrides`

/**
 * One row in the `uapkg outdated` report.
 */
export interface OutdatedEntry {
  readonly name: PackageName;
  readonly current: PackageVersion;
  readonly wanted: PackageVersion;
  readonly latest: PackageVersion;
  readonly registry: RegistryName;
  readonly status: OutdatedStatus;
}

/**
 * Compute per-dependency outdated information.
 *
 * - `wanted`  is the best version that satisfies the manifest's declared range.
 * - `latest`  is the absolute highest version in the registry, honoring the
 *             npm-style prerelease rules from {@link SemverSelectionPolicy}.
 */
export class OutdatedChecker {
  private readonly policy = new SemverSelectionPolicy();

  constructor(private readonly registryCore: RegistryCore) {}

  async check(manifest: Manifest, lockfile: Lockfile): Promise<Result<OutdatedEntry[]>> {
    const bag = new DiagnosticBag();
    const rows: OutdatedEntry[] = [];

    const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
    const overrides = manifest.kind === 'project' ? (manifest.overrides ?? {}) : {};
    const pkgs = lockfile.packages as Record<string, { version: PackageVersion; registry: RegistryName }>;

    for (const [name, locked] of Object.entries(pkgs)) {
      const decl = declared[name];
      if (!decl) continue; // transitive — skip

      const registryResult = this.registryCore.getOrCreateRegistry(decl.registry);
      if (!registryResult.ok) {
        bag.mergeArray(registryResult.diagnostics);
        continue;
      }
      const registry = registryResult.value;
      const pkgResult = await registry.getPackageManifest(name);
      if (!pkgResult.ok) {
        bag.mergeArray(pkgResult.diagnostics);
        continue;
      }
      const available = Object.keys(pkgResult.value.versions) as PackageVersion[];

      const wanted =
        this.policy.selectBest(available, decl.version, locked.version) ?? (locked.version as PackageVersion);
      const latest =
        this.policy.selectBest(available, '*' as unknown as import('@uapkg/common-schema').VersionRange, undefined) ??
        wanted;

      rows.push({
        name: name as PackageName,
        current: locked.version,
        wanted,
        latest,
        registry: locked.registry,
        status: this.classify({
          current: locked.version,
          wanted,
          latest,
          pinned: name in overrides,
        }),
      });
    }

    if (bag.hasErrors()) return bag.toFailure();
    return ok(rows);
  }

  private classify(input: {
    current: PackageVersion;
    wanted: PackageVersion;
    latest: PackageVersion;
    pinned: boolean;
  }): OutdatedStatus {
    if (input.pinned) return 'pinned';
    if (input.current !== input.wanted) return 'outdated-range';
    if (input.wanted !== input.latest) return 'outdated-latest';
    return 'up-to-date';
  }
}

