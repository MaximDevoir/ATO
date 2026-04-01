import type { DependencyPin, ManifestType, UAPMManifest } from '../domain/UAPMManifest';

export interface PackageNode {
  id: string;
  source: string;
  manifest: UAPMManifest;
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
}

export interface ResolutionResult {
  resolvedDependencies: ResolvedDependency[];
  warnings: string[];
}

export interface InstallPlan {
  rootType: ManifestType;
  rootManifest: UAPMManifest;
  rootDirectory: string;
  rootPins: DependencyPin[];
  graphNodes: PackageNode[];
  resolution: ResolutionResult;
}
