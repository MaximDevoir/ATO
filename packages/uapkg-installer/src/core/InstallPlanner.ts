import type { AssetHash, InstallPath, PackageName, PackageVersion, RegistryName } from '@uapkg/common-schema';
import { DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Lockfile } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import type { InstallAction, InstallPlan, InstallSummary } from '../contracts/InstallerTypes.js';
import type { DiskStateEntry } from './DiskStateInspector.js';

/**
 * Diffs (previousLockfile, currentLockfile, diskState) → InstallPlan.
 *
 * Rules:
 *  - Package in current lockfile, not on disk        → `add`
 *  - Package in current lockfile, on disk, same ver  → `unchanged`
 *  - Package in current lockfile, on disk, different → `update`
 *  - Package in previous lockfile only                → `remove`
 *
 * Fetches asset URLs + integrity + size from `RegistryCore` for add/update
 * actions. Pure with respect to disk (planner only reads registry metadata).
 */
export class InstallPlanner {
  constructor(private readonly registryCore: RegistryCore) {}

  async plan(
    currentLockfile: Lockfile,
    previousLockfile: Lockfile | null,
    diskState: ReadonlyMap<PackageName, DiskStateEntry>,
  ): Promise<Result<InstallPlan>> {
    const bag = new DiagnosticBag();
    const actions: InstallAction[] = [];
    let totalBytes = 0;

    const current = currentLockfile.packages as Record<string, LockEntry>;
    const previous = previousLockfile?.packages as Record<string, LockEntry> | undefined;

    for (const [rawName, locked] of Object.entries(current)) {
      const name = rawName as PackageName;
      const state = diskState.get(name);
      const defaultPath = `Plugins/${name}` as unknown as InstallPath;
      const path = state?.path ?? defaultPath;

      if (!state?.exists || !state.hasManifest || state.installedName !== name) {
        const meta = await this.fetchAssetMeta(locked, name);
        if (!meta.ok) {
          bag.mergeArray(meta.diagnostics);
          continue;
        }
        if (meta.value.sizeBytes) totalBytes += meta.value.sizeBytes;
        actions.push({
          type: 'add',
          packageName: name,
          path,
          targetVersion: locked.version,
          registry: locked.registry,
          integrity: locked.integrity,
          sizeBytes: meta.value.sizeBytes,
          downloadUrl: meta.value.downloadUrl,
        });
        continue;
      }

      if (state.installedVersion !== locked.version) {
        const meta = await this.fetchAssetMeta(locked, name);
        if (!meta.ok) {
          bag.mergeArray(meta.diagnostics);
          continue;
        }
        if (meta.value.sizeBytes) totalBytes += meta.value.sizeBytes;
        actions.push({
          type: 'update',
          packageName: name,
          path,
          targetVersion: locked.version,
          currentVersion: state.installedVersion,
          registry: locked.registry,
          integrity: locked.integrity,
          sizeBytes: meta.value.sizeBytes,
          downloadUrl: meta.value.downloadUrl,
        });
        continue;
      }

      actions.push({
        type: 'unchanged',
        packageName: name,
        path,
        targetVersion: locked.version,
        registry: locked.registry,
      });
    }

    // Removals (in previous but not in current)
    if (previous) {
      for (const rawName of Object.keys(previous)) {
        if (rawName in current) continue;
        const name = rawName as PackageName;
        const state = diskState.get(name);
        actions.push({
          type: 'remove',
          packageName: name,
          path: state?.path ?? (`Plugins/${name}` as unknown as InstallPath),
          currentVersion: previous[rawName].version,
        });
      }
    }

    const summary = this.summarize(actions, totalBytes);
    if (bag.hasErrors()) return bag.toFailure();
    return ok({ actions, summary });
  }

  private summarize(actions: readonly InstallAction[], totalBytes: number): InstallSummary {
    let added = 0,
      updated = 0,
      removed = 0,
      unchanged = 0;
    for (const a of actions) {
      if (a.type === 'add') added++;
      else if (a.type === 'update') updated++;
      else if (a.type === 'remove') removed++;
      else unchanged++;
    }
    return { added, updated, removed, unchanged, totalBytes };
  }

  private async fetchAssetMeta(
    locked: LockEntry,
    name: PackageName,
  ): Promise<Result<{ readonly downloadUrl: string; readonly sizeBytes?: number }>> {
    const bag = new DiagnosticBag();
    const registryResult = this.registryCore.getOrCreateRegistry(locked.registry);
    if (!registryResult.ok) {
      bag.mergeArray(registryResult.diagnostics);
      return bag.toFailure();
    }
    const pkgManifest = await registryResult.value.getPackageManifest(name, locked.registry);
    if (!pkgManifest.ok) {
      bag.mergeArray(pkgManifest.diagnostics);
      return bag.toFailure();
    }
    const versionEntry = (pkgManifest.value.versions as Record<string, RegistryVersionShape>)[
      locked.version as unknown as string
    ];
    if (!versionEntry) {
      bag.mergeArray([]);
      return bag.toFailure();
    }
    return ok({
      downloadUrl: versionEntry.releaseFiles.package.url,
      sizeBytes: versionEntry.releaseFiles.package.integrity.size,
    });
  }
}

// Local aliases — avoid importing schema types directly to keep this file small.
interface LockEntry {
  readonly version: PackageVersion;
  readonly registry: RegistryName;
  readonly integrity: AssetHash;
  readonly path?: InstallPath;
}

interface RegistryVersionShape {
  readonly releaseFiles: {
    readonly package: { readonly url: string; readonly integrity: { readonly size: number } };
  };
}
