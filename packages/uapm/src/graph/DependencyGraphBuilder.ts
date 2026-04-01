import { DepGraph } from 'dependency-graph';
import type { Dependency } from '../domain/UAPMManifest';
import type { ManifestRepository } from '../manifest/ManifestRepository';
import type { FileSystemService } from '../services/FileSystemService';
import type { GitClient } from '../services/GitClient';
import { parseGitReference } from '../services/GitReferenceParser';
import type { PackageNode } from './DependencyTypes';

export class DependencyGraphBuilder {
  constructor(
    private readonly manifestRepository: ManifestRepository,
    private readonly fileSystem: FileSystemService,
    private readonly gitClient: GitClient,
  ) {}

  async buildFromRoot(rootDirectory: string) {
    const rootManifest = this.manifestRepository.read(rootDirectory);
    const graph = new DepGraph<PackageNode>({ circular: true });
    const nodes: PackageNode[] = [];

    const rootNode: PackageNode = {
      id: 'root',
      source: `file:${rootDirectory}`,
      manifest: rootManifest,
    };
    graph.addNode(rootNode.id, rootNode);
    nodes.push(rootNode);

    await this.expandDependencies(graph, rootNode, rootDirectory, nodes, new Set<string>());

    return {
      rootManifest,
      graph,
      nodes,
      orderedNodeIds: graph.overallOrder(),
    };
  }

  private async expandDependencies(
    graph: DepGraph<PackageNode>,
    parent: PackageNode,
    rootDirectory: string,
    nodes: PackageNode[],
    visiting: Set<string>,
  ) {
    const dependencies = parent.manifest.dependencies ?? [];
    for (const dependency of dependencies) {
      const nodeId = `${dependency.name}|${dependency.source}`;
      if (!graph.hasNode(nodeId)) {
        const resolvedManifest = await this.resolveDependencyManifest(rootDirectory, dependency);
        const node: PackageNode = {
          id: nodeId,
          source: dependency.source,
          manifest: resolvedManifest.manifest,
          parentId: parent.id,
        };
        graph.addNode(node.id, node);
        nodes.push(node);

        if (!visiting.has(node.id)) {
          visiting.add(node.id);
          await this.expandDependencies(graph, node, rootDirectory, nodes, visiting);
          visiting.delete(node.id);
        }
      }
      if (!graph.dependenciesOf(parent.id).includes(nodeId)) {
        graph.addDependency(parent.id, nodeId);
      }
    }
  }

  private async resolveDependencyManifest(rootDirectory: string, dependency: Dependency) {
    if (dependency.source.startsWith('file:')) {
      const relative = dependency.source.slice('file:'.length);
      const directory = this.fileSystem.resolve(rootDirectory, relative);
      return {
        manifest: this.manifestRepository.read(directory),
        cleanup: () => {},
      };
    }

    const tempDirectory = this.fileSystem.createTempDir('uapm-resolve-');
    const parsed = parseGitReference(
      dependency.version ? `${dependency.source}@${dependency.version}` : dependency.source,
    );
    await this.gitClient.clone(parsed, tempDirectory);

    try {
      return {
        manifest: this.manifestRepository.read(tempDirectory),
        cleanup: () => this.fileSystem.removeDir(tempDirectory),
      };
    } finally {
      this.fileSystem.removeDir(tempDirectory);
    }
  }
}
