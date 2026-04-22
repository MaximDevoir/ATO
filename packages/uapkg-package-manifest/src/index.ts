// ---------------------------------------------------------------------------
// @uapkg/package-manifest — public API
// ---------------------------------------------------------------------------

export type {
  DependencyChangeResult,
  ManifestOperationOptions,
  PackageNode,
  ResolvedGraph,
  ResolverOptions,
} from './contracts/ManifestTypes.js';
export {
  type AddDependencyOptions,
  type DependencyBucket,
  DependencyMutator,
} from './core/DependencyMutator.js';
export { DevDependencyPolicy } from './core/DevDependencyPolicy.js';
export { InstallPathResolver, type ResolvedInstallPath } from './core/InstallPathResolver.js';
export { type LockfileChange, type LockfileDiff, LockfileDiffer } from './core/LockfileDiffer.js';
export { OutdatedChecker, type OutdatedEntry, type OutdatedStatus } from './core/OutdatedChecker.js';
export { PackageManifest, type PackageManifestOptions } from './core/PackageManifest.js';
export { WhyGraph, type WhyPath, type WhyResult } from './core/WhyGraph.js';
export { LockfileReader } from './io/LockfileReader.js';
export { LockfileWriter } from './io/LockfileWriter.js';
export { ManifestReader } from './io/ManifestReader.js';
export { ManifestWriter } from './io/ManifestWriter.js';
export { LockfileSync } from './resolver/LockfileSync.js';
export { Resolver } from './resolver/Resolver.js';
