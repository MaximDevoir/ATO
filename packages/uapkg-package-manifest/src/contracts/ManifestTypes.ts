import type { Dependency, Lockfile, Manifest } from '@uapkg/package-manifest-schema';

/** Options shared by manifest operations. */
export interface ManifestOperationOptions {
  /** Root directory containing `uapkg.json`. */
  readonly manifestRoot: string;
}

/** Result from adding or removing a dependency. */
export interface DependencyChangeResult {
  readonly manifest: Manifest;
  readonly lockfile: Lockfile;
}

/** A resolved node in the dependency graph. */
export interface PackageNode {
  readonly name: string;
  readonly version: string;
  readonly registry: string;
  readonly integrity: string;
  readonly gitTree: string;
  readonly dependencies: ReadonlyMap<string, PackageNode>;
}

/** Options for the Resolver. */
export interface ResolverOptions {
  /** Overrides to apply before resolution (from project manifest). */
  readonly overrides?: Record<string, Dependency>;
  /** If true, use lockfile and skip fresh resolution. */
  readonly frozen?: boolean;
}

/** The result of dependency resolution. */
export interface ResolvedGraph {
  /** One node per unique (registry + name + version). */
  readonly nodes: ReadonlyMap<string, PackageNode>;
  /** Direct dependencies of the root manifest. */
  readonly roots: readonly PackageNode[];
}
