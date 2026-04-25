import type { ConfigInstance } from '@uapkg/config';
import type { Dependency, LockDependency, Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import semver from 'semver';
import type { LockfileSync } from '../resolver/LockfileSync.js';
import type { Resolver } from '../resolver/Resolver.js';
import type { LockfileDiffer } from './LockfileDiffer.js';
import { type LockfileSyncIssue, sortLockfileSyncIssues } from './LockfileSyncIssue.js';

/**
 * Validates whether a lockfile is still in sync with manifest + registry state.
 */
export class LockfileSyncValidator {
  public constructor(
    private readonly registryCore: RegistryCore,
    private readonly resolver: Resolver,
    private readonly lockSync: LockfileSync,
    private readonly differ: LockfileDiffer,
    private readonly config?: InstanceType<typeof ConfigInstance>,
  ) {}

  public async collectIssues(manifest: Manifest, lockfile: Lockfile): Promise<LockfileSyncIssue[]> {
    const issues: LockfileSyncIssue[] = [];
    const declared = this.collectDeclaredDependencies(manifest);
    const configuredRegistries = this.collectConfiguredRegistries();
    const lockPackages = lockfile.packages as Record<string, LockDependency>;
    const unconfiguredRegistries = new Set<string>();

    for (const registryName of this.collectLockfileRegistries(lockPackages)) {
      if (configuredRegistries && !configuredRegistries.has(registryName)) {
        unconfiguredRegistries.add(registryName);
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_REGISTRY_UNCONFIGURED',
          message: `Registry "${registryName}" is referenced by lockfile entries but is not configured.`,
        });
      }
    }

    const expectedGraph = await this.resolver.resolve(manifest);
    if (!expectedGraph.ok) {
      for (const diagnostic of expectedGraph.diagnostics) {
        issues.push({
          severity: diagnostic.level === 'info' ? 'info' : diagnostic.level,
          code: `LOCKFILE_EXPECTED_${diagnostic.code}`,
          message: diagnostic.message,
        });
      }
    } else {
      const expectedLockfile = this.lockSync.buildLockfile(expectedGraph.value);
      const diff = this.differ.diff(lockfile, expectedLockfile);

      for (const change of diff.added) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_PACKAGE_MISSING',
          packageName: change.name,
          message: `Package "${change.name}" is required by manifest resolution but missing from lockfile.`,
        });
      }

      for (const change of diff.removed) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_PACKAGE_EXTRA',
          packageName: change.name,
          message: `Package "${change.name}" exists in lockfile but is not part of the current manifest resolution.`,
        });
      }

      for (const change of diff.updated) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_PACKAGE_MISMATCH',
          packageName: change.name,
          message: `Package "${change.name}" metadata differs between lockfile and current resolution.`,
        });
      }
    }

    const registryFailures = new Set<string>();

    for (const [packageName, entry] of Object.entries(lockPackages)) {
      if (unconfiguredRegistries.has(entry.registry)) continue;

      const declaration = declared[packageName];
      if (
        declaration &&
        !semver.satisfies(entry.version, declaration.version as unknown as string, { includePrerelease: true })
      ) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_RANGE_MISMATCH',
          packageName,
          message: `Locked version ${entry.version} for "${packageName}" does not satisfy declared range ${declaration.version}.`,
        });
      }

      const registryResult = this.registryCore.getOrCreateRegistry(entry.registry);
      if (!registryResult.ok) {
        if (!registryFailures.has(entry.registry)) {
          registryFailures.add(entry.registry);
          issues.push({
            severity: 'error',
            code: 'LOCKFILE_REGISTRY_UNRESOLVABLE',
            message: `Registry "${entry.registry}" could not be resolved for lockfile validation.`,
          });
        }
        continue;
      }

      const packageResult = await registryResult.value.getPackageManifest(packageName, entry.registry);
      if (!packageResult.ok) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_PACKAGE_NOT_FOUND_IN_REGISTRY',
          packageName,
          message: `Package "${packageName}" could not be found in registry "${entry.registry}" while validating lockfile.`,
        });
        continue;
      }

      const versionEntry = (packageResult.value.versions as Record<string, RegistryVersionShape>)[entry.version];
      if (!versionEntry) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_VERSION_NOT_FOUND_IN_REGISTRY',
          packageName,
          message: `Version ${entry.version} for "${packageName}" is not present in registry "${entry.registry}".`,
        });
        continue;
      }

      const expectedIntegrity = versionEntry.releaseFiles.package.integrity.hash;
      if (expectedIntegrity !== entry.integrity) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_INTEGRITY_MISMATCH',
          packageName,
          message: `Integrity mismatch for "${packageName}@${entry.version}" (${entry.integrity} != ${expectedIntegrity}).`,
        });
      }

      if (versionEntry.gitTree !== entry.gitTree) {
        issues.push({
          severity: 'error',
          code: 'LOCKFILE_GITTREE_MISMATCH',
          packageName,
          message: `gitTree mismatch for "${packageName}@${entry.version}" (${entry.gitTree} != ${versionEntry.gitTree}).`,
        });
      }
    }

    return sortLockfileSyncIssues(issues);
  }

  public topIssues(issues: readonly LockfileSyncIssue[], count: number): readonly LockfileSyncIssue[] {
    return sortLockfileSyncIssues(issues).slice(0, count);
  }

  private collectDeclaredDependencies(manifest: Manifest): Record<string, Dependency> {
    return {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
    };
  }

  private collectLockfileRegistries(lockPackages: Record<string, LockDependency>): Set<string> {
    const out = new Set<string>();
    for (const entry of Object.values(lockPackages)) {
      out.add(entry.registry);
    }
    return out;
  }

  private collectConfiguredRegistries(): Set<string> | null {
    if (!this.config) return null;
    const all = this.config.getAll();
    if (!all || typeof all !== 'object') return null;

    const registries = (all as { registries?: Record<string, unknown> }).registries;
    if (!registries || typeof registries !== 'object') return null;

    return new Set(Object.keys(registries));
  }
}

interface RegistryVersionShape {
  readonly gitTree: string;
  readonly releaseFiles: {
    readonly package: {
      readonly integrity: {
        readonly hash: string;
      };
    };
  };
}
