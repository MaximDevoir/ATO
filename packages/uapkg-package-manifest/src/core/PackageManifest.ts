import type { ConfigInstance } from '@uapkg/config';
import { createForbiddenOverridesDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import type { ResolvedGraph, ResolverOptions } from '../contracts/ManifestTypes.js';
import { LockfileReader } from '../io/LockfileReader.js';
import { LockfileWriter } from '../io/LockfileWriter.js';
import { ManifestReader } from '../io/ManifestReader.js';
import { ManifestWriter } from '../io/ManifestWriter.js';
import { LockfileSync } from '../resolver/LockfileSync.js';
import { Resolver } from '../resolver/Resolver.js';

export interface PackageManifestOptions {
  /** Absolute path to the directory containing `uapkg.json`. */
  readonly manifestRoot: string;
  /** The `RegistryCore` instance to use for registry operations. */
  readonly registryCore: RegistryCore;
  /** Optional `@uapkg/config` instance to share state. */
  readonly configInstance?: InstanceType<typeof ConfigInstance>;
}

/**
 * High-level facade for working with `uapkg.json` and `uapkg.lock`.
 *
 * All operations execute relative to `manifestRoot`.
 */
export class PackageManifest {
  private readonly manifestRoot: string;
  private readonly reader: ManifestReader;
  private readonly writer: ManifestWriter;
  private readonly lockReader: LockfileReader;
  private readonly lockWriter: LockfileWriter;
  private readonly resolver: Resolver;
  private readonly lockSync: LockfileSync;

  constructor(options: PackageManifestOptions) {
    this.manifestRoot = options.manifestRoot;
    this.reader = new ManifestReader();
    this.writer = new ManifestWriter();
    this.lockReader = new LockfileReader();
    this.lockWriter = new LockfileWriter();
    this.resolver = new Resolver(options.registryCore);
    this.lockSync = new LockfileSync();
  }

  // -------------------------------------------------------------------
  // Read / Write
  // -------------------------------------------------------------------

  /** Read and validate `uapkg.json`. */
  async readManifest(): Promise<Result<Manifest>> {
    return this.reader.read(this.manifestRoot);
  }

  /** Write `uapkg.json`. */
  async writeManifest(manifest: Manifest): Promise<Result<void>> {
    return this.writer.write(this.manifestRoot, manifest);
  }

  /** Read and validate `uapkg.lock`. */
  async readLockfile(): Promise<Result<Lockfile>> {
    return this.lockReader.read(this.manifestRoot);
  }

  /** Write `uapkg.lock`. */
  async writeLockfile(lockfile: Lockfile): Promise<Result<void>> {
    return this.lockWriter.write(this.manifestRoot, lockfile);
  }

  // -------------------------------------------------------------------
  // Higher-level operations
  // -------------------------------------------------------------------

  /** Validate the manifest (schema + business rules). */
  async validate(): Promise<Result<Manifest>> {
    const bag = new DiagnosticBag();
    const readResult = await this.readManifest();
    if (!readResult.ok) return readResult;

    const manifest = readResult.value;

    // Overrides only in project manifests
    if (manifest.kind === 'plugin' && 'overrides' in manifest) {
      bag.add(createForbiddenOverridesDiagnostic('plugin', this.manifestRoot));
    }

    return bag.hasErrors() ? bag.toFailure() : ok(manifest);
  }

  /** Resolve dependencies and produce a lockfile. */
  async resolve(options: ResolverOptions = {}): Promise<Result<ResolvedGraph>> {
    const manifestResult = await this.readManifest();
    if (!manifestResult.ok) return manifestResult as Result<never>;

    const manifest = manifestResult.value;
    const overrides =
      manifest.kind === 'project' && 'overrides' in manifest
        ? (manifest as { overrides?: Record<string, any> }).overrides
        : undefined;

    return this.resolver.resolve(manifest, { ...options, overrides });
  }

  /** Resolve and write `uapkg.lock`. */
  async install(options: ResolverOptions = {}): Promise<Result<Lockfile>> {
    const bag = new DiagnosticBag();

    if (options.frozen) {
      // Frozen install: use lockfile directly, no resolution
      return this.readLockfile();
    }

    const graphResult = await this.resolve(options);
    if (!graphResult.ok) {
      bag.mergeArray(graphResult.diagnostics);
      return bag.toFailure();
    }

    const lockfile = this.lockSync.buildLockfile(graphResult.value);
    const writeResult = await this.writeLockfile(lockfile);
    if (!writeResult.ok) {
      bag.mergeArray(writeResult.diagnostics);
      return bag.toFailure();
    }

    return ok(lockfile);
  }
}
