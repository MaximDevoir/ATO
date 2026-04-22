import type { PackageName, PackageVersion } from '@uapkg/common-schema';
import type { PackageNode, ResolvedGraph } from '../contracts/ManifestTypes.js';

/**
 * One ancestor chain showing *why* a package is present in the graph.
 * Ordered root → target.
 */
export interface WhyPath {
  readonly path: readonly {
    readonly name: PackageName;
    readonly version: PackageVersion;
  }[];
}

/**
 * Full `uapkg why <name>` result.
 */
export interface WhyResult {
  readonly target: PackageName;
  readonly paths: readonly WhyPath[];
  readonly foundAsRoot: boolean;
}

/**
 * Walk a resolved dependency graph to enumerate every path from a root node
 * down to the target package. Pure — no IO, no shared state.
 */
export class WhyGraph {
  explain(graph: ResolvedGraph, target: PackageName): WhyResult {
    const paths: WhyPath[] = [];
    let foundAsRoot = false;

    for (const root of graph.roots) {
      if (root.name === target) foundAsRoot = true;
      this.walk(root, target, [], paths);
    }

    return { target, paths, foundAsRoot };
  }

  private walk(
    node: PackageNode,
    target: PackageName,
    stack: { name: PackageName; version: PackageVersion }[],
    out: WhyPath[],
  ): void {
    const nextStack = [...stack, { name: node.name as PackageName, version: node.version as PackageVersion }];

    if (node.name === target) {
      out.push({ path: nextStack });
      // Do not descend into a target child in the same chain — we've explained it.
      return;
    }

    for (const child of node.dependencies.values()) {
      // Cycle guard — a node cannot appear twice in the same path.
      if (nextStack.some((e) => e.name === child.name && e.version === child.version)) continue;
      this.walk(child, target, nextStack, out);
    }
  }
}
