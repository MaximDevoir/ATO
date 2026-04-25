import type { RegistryIdentifier, UnixTimestamp } from '@uapkg/common-schema';
import {
  createRegistryUnreachableDiagnostic,
  type Diagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
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
  private readonly aliases = new Set<string>();

  private hasUpdatedThisProcess = false;
  private initPromise?: Promise<Result<void>>;

  private readonly metadataReader: RegistryMetadataReader;
  private readonly updater: RegistryUpdater;
  private readonly packageReader: RegistryPackageReader;
  private ttlSeconds: number;

  private constructor(
    initialAlias: string,
    descriptor: RegistryDescriptor,
    id: RegistryIdentifier,
    shortId: string,
    gitBinary: string,
    ttlSeconds: number,
  ) {
    this.aliases.add(initialAlias);
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
    initialAlias: string,
    descriptor: RegistryDescriptor,
    id: RegistryIdentifier,
    shortId: string,
    gitBinary: string,
    ttlSeconds: number,
  ): Registry {
    return new Registry(initialAlias, descriptor, id, shortId, gitBinary, ttlSeconds);
  }

  public registerAlias(alias: string, ttlSeconds?: number): void {
    if (alias.trim().length === 0) return;
    this.aliases.add(alias);
    if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds)) {
      this.ttlSeconds = Math.min(this.ttlSeconds, ttlSeconds);
    }
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  /** Ensure the local cache is up-to-date. */
  async ensureUpToDate(
    options?: RegistryUpdateOptions & { readonly logicalRegistryName?: string },
  ): Promise<Result<RegistryUpdateResult>> {
    const forced = options?.bypassFreshnessCheck ?? false;
    const lastSyncAt = await this.getLastSyncTimestamp();
    const initialized = this.metadataReader.exists();

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

    return this.performUpdate(initialized, options?.logicalRegistryName);
  }

  /** Read a package registry manifest from the local cache. */
  async getPackageManifest(
    packageName: string,
    logicalRegistryName?: string,
  ): Promise<Result<PackageRegistryManifest>> {
    const bag = new DiagnosticBag();
    const readyResult = await this.ensureReady(logicalRegistryName);
    if (!readyResult.ok) return readyResult as Result<never>;
    bag.mergeArray(readyResult.diagnostics);

    const packageResult = await this.packageReader.readPackageManifest(packageName);
    if (!packageResult.ok) {
      bag.mergeArray(packageResult.diagnostics);
      return bag.toFailure();
    }

    return bag.toResult(packageResult.value);
  }

  /** Resolve the best matching version for a package. */
  async resolvePackage(
    packageName: string,
    versionRange: string,
    registryName: string,
    current?: string,
  ): Promise<Result<ResolvedVersion>> {
    const bag = new DiagnosticBag();
    const manifestResult = await this.getPackageManifest(packageName, registryName);
    if (!manifestResult.ok) return manifestResult as Result<never>;
    bag.mergeArray(manifestResult.diagnostics);

    const resolved = resolveVersion(manifestResult.value, versionRange, registryName, current);
    if (!resolved.ok) {
      bag.mergeArray(resolved.diagnostics);
      return bag.toFailure();
    }

    return bag.toResult(resolved.value);
  }

  // -------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------

  private async ensureReady(logicalRegistryName?: string): Promise<Result<void>> {
    if (!this.initPromise) {
      this.initPromise = this.ensureUpToDate({ logicalRegistryName }).then((r) =>
        r.ok ? ok(undefined, r.diagnostics) : r,
      );
    }
    return this.initPromise;
  }

  private async performUpdate(
    initialized: boolean,
    logicalRegistryName?: string,
  ): Promise<Result<RegistryUpdateResult>> {
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
        const unreachable = this.toRegistryUnreachableDiagnostic(
          updateResult.diagnostics,
          initialized,
          logicalRegistryName,
        );
        if (initialized) {
          this.hasUpdatedThisProcess = true;
          return ok('Failed', [unreachable]);
        }
        bag.add(unreachable);
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

  private toRegistryUnreachableDiagnostic(
    diagnostics: readonly Diagnostic[],
    initialized: boolean,
    logicalRegistryName?: string,
  ) {
    const first = diagnostics[0];
    const cause = first?.message ?? 'Registry update failed.';
    const httpStatus = this.extractHttpStatus(cause);

    return createRegistryUnreachableDiagnostic({
      registryName: this.resolveDiagnosticRegistryName(logicalRegistryName),
      url: this.descriptor.url,
      cause,
      initialized,
      httpStatus,
      level: initialized ? 'warning' : 'error',
    });
  }

  private extractHttpStatus(text: string): number | undefined {
    const match = text.match(/\b([1-5][0-9][0-9])\b/);
    if (!match) return undefined;
    return Number(match[1]);
  }

  private resolveDiagnosticRegistryName(logicalRegistryName?: string): string {
    if (logicalRegistryName && logicalRegistryName.trim().length > 0) {
      return logicalRegistryName;
    }

    const aliases = [...this.aliases].sort((a, b) => a.localeCompare(b));
    if (aliases.length === 0) return this.shortId;
    if (aliases.length === 1) return aliases[0];
    return `${aliases[0]} (+${aliases.length - 1} aliases)`;
  }
}
