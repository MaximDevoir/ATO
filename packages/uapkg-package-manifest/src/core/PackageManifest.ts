import { join } from 'node:path';
import type { PackageName } from '@uapkg/common-schema';
import type { ConfigInstance } from '@uapkg/config';
import {
  createDependencyNotFoundDiagnostic,
  createForbiddenOverridesDiagnostic,
  createLockfileOutOfSyncDiagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { Dependency, Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import type { ResolvedGraph, ResolverOptions } from '../contracts/ManifestTypes.js';
import { LockfileReader } from '../io/LockfileReader.js';
import { LockfileSyncIssueWriter } from '../io/LockfileSyncIssueWriter.js';
import { LockfileWriter } from '../io/LockfileWriter.js';
import { ManifestReader } from '../io/ManifestReader.js';
import { ManifestWriter } from '../io/ManifestWriter.js';
import { LockfileSync } from '../resolver/LockfileSync.js';
import { Resolver } from '../resolver/Resolver.js';
import { type AddDependencyOptions, DependencyMutator } from './DependencyMutator.js';
import { type LockfileDiff, LockfileDiffer } from './LockfileDiffer.js';
import { sortLockfileSyncIssues } from './LockfileSyncIssue.js';
import { LockfileSyncValidator } from './LockfileSyncValidator.js';
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
  private readonly lockfileSyncValidator: LockfileSyncValidator;
  private readonly lockfileSyncIssueWriter = new LockfileSyncIssueWriter();
  private readonly outdated: OutdatedChecker;
  private readonly whyGraph = new WhyGraph();

  constructor(options: PackageManifestOptions) {
    this.manifestRoot = options.manifestRoot;
    this.registryCore = options.registryCore;
    this.resolver = new Resolver(options.registryCore);
    this.outdated = new OutdatedChecker(options.registryCore);
    this.lockfileSyncValidator = new LockfileSyncValidator(
      options.registryCore,
      this.resolver,
      this.lockSync,
      this.differ,
      options.configInstance,
    );
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
    return this.lockReader.readRequired(this.manifestRoot);
  }

  async readLockfileOptional(): Promise<Result<Lockfile | null>> {
    return this.lockReader.readOptional(this.manifestRoot);
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
      const lockResult = await this.readLockfile();
      if (!lockResult.ok) return lockResult;

      const syncResult = await this.validateLockfileSync(lockResult.value);
      if (!syncResult.ok) return syncResult;

      return ok(lockResult.value, [...lockResult.diagnostics, ...syncResult.diagnostics]);
    }

    const existingLockResult = await this.readLockfileOptional();
    if (!existingLockResult.ok) {
      bag.mergeArray(existingLockResult.diagnostics);
      return bag.toFailure();
    }
    bag.mergeArray(existingLockResult.diagnostics);

    if (existingLockResult.value !== null) {
      const manifestResult = await this.readManifest();
      if (!manifestResult.ok) return manifestResult as Result<never>;

      const issues = await this.lockfileSyncValidator.collectIssues(manifestResult.value, existingLockResult.value);
      if (issues.length === 0) {
        return bag.toResult(existingLockResult.value);
      }
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
    const bag = new DiagnosticBag();
    const readResult = await this.readManifest();
    if (!readResult.ok) return readResult;
    const removed = this.mutator.removeDependency(readResult.value, name);
    if (!removed.removed) {
      bag.add(createDependencyNotFoundDiagnostic(name));
    }

    const writeResult = await this.writeManifest(removed.manifest);
    if (!writeResult.ok) return writeResult as Result<never>;
    return bag.toResult(removed.manifest);
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
    const lockResult = await this.getLockfileForReadOnly();
    if (!lockResult.ok) return lockResult as Result<never>;
    bag.mergeArray(lockResult.diagnostics);

    const outdatedResult = await this.outdated.check(manifestResult.value, lockResult.value);
    if (!outdatedResult.ok) {
      bag.mergeArray(outdatedResult.diagnostics);
      return bag.toFailure();
    }
    return bag.toResult(outdatedResult.value);
  }

  async explainWhy(target: PackageName): Promise<Result<WhyResult>> {
    const bag = new DiagnosticBag();
    const lockResult = await this.readLockfileOptional();
    if (!lockResult.ok) return lockResult as Result<never>;
    bag.mergeArray(lockResult.diagnostics);

    const graphResult = await this.resolve();
    if (!graphResult.ok) return graphResult as Result<never>;
    return bag.toResult(this.whyGraph.explain(graphResult.value, target));
  }

  async getLockfileForReadOnly(): Promise<Result<Lockfile>> {
    const bag = new DiagnosticBag();
    const lockResult = await this.readLockfileOptional();
    if (!lockResult.ok) return lockResult as Result<never>;
    bag.mergeArray(lockResult.diagnostics);

    if (lockResult.value !== null) {
      return bag.toResult(lockResult.value);
    }

    const resolveResult = await this.resolve();
    if (!resolveResult.ok) {
      bag.mergeArray(resolveResult.diagnostics);
      return bag.toFailure();
    }

    const lockfile = this.lockSync.buildLockfile(resolveResult.value);
    return bag.toResult(lockfile);
  }

  async validateLockfileSync(lockfile: Lockfile): Promise<Result<void>> {
    const bag = new DiagnosticBag();
    const manifestResult = await this.readManifest();
    if (!manifestResult.ok) return manifestResult as Result<never>;

    const issues = await this.lockfileSyncValidator.collectIssues(manifestResult.value, lockfile);
    if (issues.length === 0) return ok(undefined);

    const sortedIssues = sortLockfileSyncIssues(issues);
    const topIssues = this.lockfileSyncValidator.topIssues(sortedIssues, 3);

    let logPath = join(this.manifestRoot, '.uapkg', 'logs', 'lockfile-sync.log');
    const logResult = await this.lockfileSyncIssueWriter.write(this.manifestRoot, sortedIssues);
    if (logResult.ok) {
      logPath = logResult.value;
      bag.mergeArray(logResult.diagnostics);
    } else {
      bag.mergeArray(logResult.diagnostics);
    }

    bag.add(
      createLockfileOutOfSyncDiagnostic(
        topIssues.map((issue) => ({
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          packageName: issue.packageName,
        })),
        sortedIssues.length,
        logPath,
      ),
    );

    return bag.toFailure();
  }
}
