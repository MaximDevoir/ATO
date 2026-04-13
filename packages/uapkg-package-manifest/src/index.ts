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
export { PackageManifest, type PackageManifestOptions } from './core/PackageManifest.js';
export { LockfileReader } from './io/LockfileReader.js';
export { LockfileWriter } from './io/LockfileWriter.js';
export { ManifestReader } from './io/ManifestReader.js';
export { ManifestWriter } from './io/ManifestWriter.js';
export { LockfileSync } from './resolver/LockfileSync.js';
export { Resolver } from './resolver/Resolver.js';
