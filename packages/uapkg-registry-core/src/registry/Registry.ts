import type { RegistryIdentifier, UnixTimestamp } from '@uapkg/common-schema';
import { DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { PackageRegistryManifest } from '@uapkg/registry-schema';
import type {
  RegistryDescriptor,
  RegistryUpdateOptions,
  RegistryUpdateResult,
} from '../contracts/RegistryCoreTypes.js';
import { getRegistryLockPath } from '../paths/RegistryPaths.js';
import { type ResolvedVersion, resolveVersion } from '../resolution/PackageResolver.js';
import { RegistryLock } from './RegistryLock.js';
import { RegistryMetadataReader } from './RegistryMetadataReader.js';
import { RegistryPackageReader } from './RegistryPackageReader.js';
import { evaluateSyncPolicy } from './RegistrySyncPolicy.js';
import { RegistryUpdater } from './RegistryUpdater.js';

/**
 * Represents one configured local registry cache.
 *
 * Exposes registry-level operations: sync, read manifests, resolve versions.
 */
export class Registry {
  public readonly id: RegistryIdentifier;
  public readonly descriptor: RegistryDescriptor;
  public readonly shortId: string;

  private hasUpdatedThisProcess = false;
  private initPromise?: Promise<Result<void>>;

  private readonly metadataReader: RegistryMetadataReader;
  private readonly updater: RegistryUpdater;
  private readonly packageReader: RegistryPackageReader;
  private readonly ttlSeconds: number;

  private constructor(
    descriptor: RegistryDescriptor,
    id: RegistryIdentifier,
    shortId: string,
    gitBinary: string,
    ttlSeconds: number,
  ) {
    this.descriptor = descriptor;
    this.id = id;
    this.shortId = shortId;
    this.ttlSeconds = ttlSeconds;
    this.metadataReader = new RegistryMetadataReader(shortId);
    this.updater = new RegistryUpdater(shortId, descriptor, gitBinary);
    this.packageReader = new RegistryPackageReader(shortId);
  }

  /** Factory — use this instead of `new`. */
  static create(
    descriptor: RegistryDescriptor,
    id: RegistryIdentifier,
    shortId: string,
    gitBinary: string,
    ttlSeconds: number,
  ): Registry {
    return new Registry(descriptor, id, shortId, gitBinary, ttlSeconds);
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /** Ensure the local cache is up-to-date. */
  async ensureUpToDate(options?: RegistryUpdateOptions): Promise<Result<RegistryUpdateResult>> {
    const forced = options?.bypassFreshnessCheck ?? false;
    const lastSyncAt = await this.getLastSyncTimestamp();

    const decision = evaluateSyncPolicy({
      lastSyncAt,
      ttlSeconds: this.ttlSeconds,
      hasUpdatedWithinProcessLifetime: this.hasUpdatedThisProcess,
      forced,
    });

    if (decision === 'skip') {
      const reason: RegistryUpdateResult = this.hasUpdatedThisProcess ? 'UpdatedRecently' : 'AlreadyFresh';
      return ok(reason);
    }

    return this.performUpdate();
  }

  /** Read a package registry manifest from the local cache. */
  async getPackageManifest(packageName: string): Promise<Result<PackageRegistryManifest>> {
    const readyResult = await this.ensureReady();
    if (!readyResult.ok) return readyResult as Result<never>;
    return this.packageReader.readPackageManifest(packageName);
  }

  /** Resolve the best matching version for a package. */
  async resolvePackage(
    packageName: string,
    versionRange: string,
    registryName: string,
  ): Promise<Result<ResolvedVersion>> {
    const manifestResult = await this.getPackageManifest(packageName);
    if (!manifestResult.ok) return manifestResult as Result<never>;
    return resolveVersion(manifestResult.value, versionRange, registryName);
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  private async ensureReady(): Promise<Result<void>> {
    if (!this.initPromise) {
      this.initPromise = this.ensureUpToDate().then((r) =>
        r.ok ? ok(undefined) : { ok: false as const, diagnostics: r.diagnostics },
      );
    }
    return this.initPromise;
  }

  private async performUpdate(): Promise<Result<RegistryUpdateResult>> {
    const bag = new DiagnosticBag();
    const lock = new RegistryLock(getRegistryLockPath(this.shortId));

    const lockResult = await lock.acquire();
    if (!lockResult.ok) {
      bag.mergeArray(lockResult.diagnostics);
      return bag.toFailure();
    }

    try {
      // Re-check freshness after acquiring lock (another process may have updated)
      const lastSync = await this.getLastSyncTimestamp();
      const recheck = evaluateSyncPolicy({
        lastSyncAt: lastSync,
        ttlSeconds: this.ttlSeconds,
        hasUpdatedWithinProcessLifetime: false,
        forced: false,
      });

      if (recheck === 'skip') {
        this.hasUpdatedThisProcess = true;
        return ok('AlreadyFresh');
      }

      const updateResult = await this.updater.update();
      if (!updateResult.ok) {
        bag.mergeArray(updateResult.diagnostics);
        return bag.toFailure();
      }

      await this.writeMetadata();
      this.hasUpdatedThisProcess = true;
      return ok('Updated');
    } finally {
      await lock.release();
    }
  }

  private async getLastSyncTimestamp(): Promise<UnixTimestamp | undefined> {
    const result = await this.metadataReader.read();
    if (!result.ok) return undefined;
    return result.value.lastRegistrySyncAt;
  }

  private async writeMetadata(): Promise<void> {
    const now = Math.floor(Date.now() / 1000) as UnixTimestamp;
    await this.metadataReader.write({ lastRegistrySyncAt: now, registryIdentifier: this.id });
  }
}
