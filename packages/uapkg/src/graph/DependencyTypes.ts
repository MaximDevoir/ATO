import type { ManifestType, UAPKGManifest } from '../domain/UAPKGManifest.js';

export interface PackageNode {
  id: string;
  source: string;
  manifest: UAPKGManifest;
  parentId?: string;
}

export interface DependencyRequirement {
  name: string;
  source: string;
  version?: string;
  requestedBy: string;
}

export interface ResolvedDependency {
  name: string;
  source: string;
  version?: string;
  hash?: string;
  dependencies?: string[];
}

export interface ResolutionResult {
  resolvedDependencies: ResolvedDependency[];
  warnings: string[];
}

export interface InstallPlan {
  rootType: ManifestType;
  rootManifest: UAPKGManifest;
  rootDirectory: string;
  graphNodes: PackageNode[];
  resolution: ResolutionResult;
}
