import {
  createCircularDepDiagnostic,
  createRegistryNameCollisionDiagnostic,
  createUnresolvedRegistryDiagnostic,
  createVersionConflictDiagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { Dependency, Manifest } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import type { PackageNode, ResolvedGraph, ResolverOptions } from '../contracts/ManifestTypes.js';

/**
 * Pure dependency resolver.
 *
 * - Resolves dependency intent → resolved graph using `RegistryCore`.
 * - Deduplicates by (registry + name + version).
 * - Detects cycles and version conflicts for single-version packages.
 * - Applies overrides before resolution.
 * - Has NO side effects.
 */
export class Resolver {
  constructor(private readonly registryCore: RegistryCore) {}

  async resolve(manifest: Manifest, options: ResolverOptions = {}): Promise<Result<ResolvedGraph>> {
    const bag = new DiagnosticBag();
    const nodes = new Map<string, PackageNode>();
    const visiting = new Set<string>();
    const roots: PackageNode[] = [];

    const deps = this.applyOverrides(manifest.dependencies ?? {}, options.overrides);

    for (const [name, dep] of Object.entries(deps)) {
      const result = await this.resolveNode(name, dep, bag, nodes, visiting, []);
      if (result) {
        roots.push(result);
      }
    }

    // Check for cross-registry name collisions
    this.checkNameCollisions(nodes, bag);

    if (bag.hasErrors()) {
      return bag.toFailure();
    }

    return ok({ nodes, roots });
  }

  private async resolveNode(
    name: string,
    dep: Dependency,
    bag: DiagnosticBag,
    nodes: Map<string, PackageNode>,
    visiting: Set<string>,
    path: string[],
  ): Promise<PackageNode | null> {
    const registryResult = this.registryCore.getOrCreateRegistry(dep.registry);
    if (!registryResult.ok) {
      bag.add(createUnresolvedRegistryDiagnostic(dep.registry, name));
      return null;
    }

    const registry = registryResult.value;
    const resolved = await registry.resolvePackage(name, dep.version, dep.registry);
    if (!resolved.ok) {
      bag.mergeArray(resolved.diagnostics);
      return null;
    }

    const nodeKey = `${dep.registry}::${name}@${resolved.value.version}`;

    // Cycle detection
    if (visiting.has(nodeKey)) {
      bag.add(createCircularDepDiagnostic([...path, name]));
      return null;
    }

    // Dedup — already resolved
    const existing = nodes.get(nodeKey);
    if (existing) return existing;

    visiting.add(nodeKey);
    const childDeps = new Map<string, PackageNode>();

    const versionEntry = resolved.value.entry;
    if (versionEntry.dependencies) {
      for (const [childName, childDep] of Object.entries(versionEntry.dependencies)) {
        const child = await this.resolveNode(
          childName,
          { version: childDep.version, registry: childDep.registry },
          bag,
          nodes,
          visiting,
          [...path, name],
        );
        if (child) {
          childDeps.set(childName, child);
        }
      }
    }

    visiting.delete(nodeKey);

    const node: PackageNode = {
      name,
      version: resolved.value.version,
      registry: dep.registry,
      integrity: versionEntry.releaseFiles.package.integrity.hash,
      gitTree: versionEntry.gitTree,
      dependencies: childDeps,
    };

    // Single-version conflict detection
    const conflictKey = `${dep.registry}::${name}`;
    for (const [key, existing] of nodes) {
      if (key.startsWith(conflictKey) && existing.version !== node.version) {
        bag.add(createVersionConflictDiagnostic(name, [existing.version, node.version], dep.registry));
      }
    }

    nodes.set(nodeKey, node);
    return node;
  }

  private applyOverrides(
    deps: Record<string, Dependency>,
    overrides?: Record<string, Dependency>,
  ): Record<string, Dependency> {
    if (!overrides) return deps;
    return { ...deps, ...overrides };
  }

  private checkNameCollisions(nodes: Map<string, PackageNode>, bag: DiagnosticBag): void {
    const nameToRegistries = new Map<string, Set<string>>();
    for (const node of nodes.values()) {
      const registries = nameToRegistries.get(node.name) ?? new Set();
      registries.add(node.registry);
      nameToRegistries.set(node.name, registries);
    }

    for (const [name, registries] of nameToRegistries) {
      if (registries.size > 1) {
        bag.add(createRegistryNameCollisionDiagnostic(name, [...registries]));
      }
    }
  }
}
