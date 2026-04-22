import type { Dependency, Manifest } from '@uapkg/package-manifest-schema';

/**
 * Policy codifying the uapkg rule:
 *
 *   `devDependencies` only apply when the manifest is the **root** of the
 *   dependency graph under development (the project manifest, or a plugin
 *   manifest that the developer is currently building locally).
 *
 * Transitive `devDependencies` of installed packages are never resolved or
 * installed. This mirrors npm and cargo.
 */
export class DevDependencyPolicy {
  /**
   * @param manifest The manifest being walked.
   * @param isRoot True only for the very top of the walk (the manifest the
   *   user invoked the command from).
   * @returns The set of dependency buckets to walk for this node.
   */
  pickBuckets(
    manifest: Manifest,
    isRoot: boolean,
  ): Array<{ bucket: 'dependencies' | 'devDependencies' | 'peerDependencies'; map: Record<string, Dependency> }> {
    const out: Array<{
      bucket: 'dependencies' | 'devDependencies' | 'peerDependencies';
      map: Record<string, Dependency>;
    }> = [];
    if (manifest.dependencies) out.push({ bucket: 'dependencies', map: manifest.dependencies });
    if (isRoot && manifest.devDependencies) out.push({ bucket: 'devDependencies', map: manifest.devDependencies });
    if (manifest.peerDependencies) out.push({ bucket: 'peerDependencies', map: manifest.peerDependencies });
    return out;
  }

  /**
   * Should a transitive child's `devDependencies` be walked? Always false.
   */
  includeTransitiveDev(): boolean {
    return false;
  }
}

