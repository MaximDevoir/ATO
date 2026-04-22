import type { PackageName } from '@uapkg/common-schema';
import type { ConfigInstance } from '@uapkg/config';
import { createForbiddenOverridesDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Dependency, Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import type { ResolvedGraph, ResolverOptions } from '../contracts/ManifestTypes.js';
import { LockfileReader } from '../io/LockfileReader.js';
import { LockfileWriter } from '../io/LockfileWriter.js';
import { ManifestReader } from '../io/ManifestReader.js';
import { ManifestWriter } from '../io/ManifestWriter.js';
import { LockfileSync } from '../resolver/LockfileSync.js';
import { Resolver } from '../resolver/Resolver.js';
import { type AddDependencyOptions, DependencyMutator } from './DependencyMutator.js';
import { type LockfileDiff, LockfileDiffer } from './LockfileDiffer.js';
import { OutdatedChecker, type OutdatedEntry } from './OutdatedChecker.js';
import { WhyGraph, type WhyResult } from './WhyGraph.js';

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
 * All operations execute relative to `manifestRoot`. Composes small,
 * single-responsibility collaborators (reader/writer, resolver, mutator,
 * differ, outdated-checker, why-graph). Never throws — all fallible paths
 * return a `Result<T>` carrying diagnostics.
 */
export class PackageManifest {
  private readonly manifestRoot: string;
  private readonly registryCore: RegistryCore;
  private readonly reader = new ManifestReader();
  private readonly writer = new ManifestWriter();
  private readonly lockReader = new LockfileReader();
  private readonly lockWriter = new LockfileWriter();
  private readonly resolver: Resolver;
  private readonly lockSync = new LockfileSync();
  private readonly mutator = new DependencyMutator();
  private readonly differ = new LockfileDiffer();
  private readonly outdated: OutdatedChecker;
  private readonly whyGraph = new WhyGraph();

  constructor(options: PackageManifestOptions) {
    this.manifestRoot = options.manifestRoot;
    this.registryCore = options.registryCore;
    this.resolver = new Resolver(options.registryCore);
    this.outdated = new OutdatedChecker(options.registryCore);
  }

  // -------------------------------------------------------------------
  // Read / Write
  // -------------------------------------------------------------------

  async readManifest(): Promise<Result<Manifest>> {
    return this.reader.read(this.manifestRoot);
  }

  async writeManifest(manifest: Manifest): Promise<Result<void>> {
    return this.writer.write(this.manifestRoot, manifest);
  }

  async readLockfile(): Promise<Result<Lockfile>> {
    return this.lockReader.read(this.manifestRoot);
  }

  async writeLockfile(lockfile: Lockfile): Promise<Result<void>> {
    return this.lockWriter.write(this.manifestRoot, lockfile);
  }

  // -------------------------------------------------------------------
  // Validation + resolution
  // -------------------------------------------------------------------

  async validate(): Promise<Result<Manifest>> {
    const bag = new DiagnosticBag();
    const readResult = await this.readManifest();
    if (!readResult.ok) return readResult;

    const manifest = readResult.value;
    if (manifest.kind === 'plugin' && 'overrides' in manifest) {
      bag.add(createForbiddenOverridesDiagnostic('plugin', this.manifestRoot));
    }

    return bag.hasErrors() ? bag.toFailure() : ok(manifest);
  }

  async resolve(options: ResolverOptions = {}): Promise<Result<ResolvedGraph>> {
    const manifestResult = await this.readManifest();
    if (!manifestResult.ok) return manifestResult as Result<never>;

    const manifest = manifestResult.value;
    const overrides =
      manifest.kind === 'project' && 'overrides' in manifest
        ? (manifest as { overrides?: Record<string, Dependency> }).overrides
        : undefined;

    return this.resolver.resolve(manifest, { ...options, overrides });
  }

  async install(options: ResolverOptions = {}): Promise<Result<Lockfile>> {
    const bag = new DiagnosticBag();

    if (options.frozen) {
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

  // -------------------------------------------------------------------
  // Mutation — delegates to DependencyMutator, persists via writer.
  // -------------------------------------------------------------------

  /** Add or replace a dependency and persist `uapkg.json`. */
  async addDependency(name: string, dep: Dependency, options: AddDependencyOptions = {}): Promise<Result<Manifest>> {
    const readResult = await this.readManifest();
    if (!readResult.ok) return readResult;
    const next = this.mutator.addDependency(readResult.value, name, dep, options);
    const writeResult = await this.writeManifest(next);
    if (!writeResult.ok) return writeResult as Result<never>;
    return ok(next);
  }

  /** Remove a dependency from every bucket and persist `uapkg.json`. */
  async removeDependency(name: string): Promise<Result<Manifest>> {
    const readResult = await this.readManifest();
    if (!readResult.ok) return readResult;
    const next = this.mutator.removeDependency(readResult.value, name);
    const writeResult = await this.writeManifest(next);
    if (!writeResult.ok) return writeResult as Result<never>;
    return ok(next);
  }

  // -------------------------------------------------------------------
  // Reports
  // -------------------------------------------------------------------

  diffLockfile(previous: Lockfile | null, current: Lockfile): LockfileDiff {
    return this.differ.diff(previous, current);
  }

  async checkOutdated(): Promise<Result<OutdatedEntry[]>> {
    const bag = new DiagnosticBag();
    const manifestResult = await this.readManifest();
    if (!manifestResult.ok) return manifestResult as Result<never>;
    const lockResult = await this.readLockfile();
    if (!lockResult.ok) {
      bag.mergeArray(lockResult.diagnostics);
      return bag.toFailure();
    }
    return this.outdated.check(manifestResult.value, lockResult.value);
  }

  async explainWhy(target: PackageName): Promise<Result<WhyResult>> {
    const graphResult = await this.resolve();
    if (!graphResult.ok) return graphResult as Result<never>;
    return ok(this.whyGraph.explain(graphResult.value, target));
  }
}
