import semver from 'semver';
import type { DependencyOverride, UAPKGManifest } from '../domain/UAPKGManifest.js';
import type { GitClient } from '../services/GitClient.js';
import type { DependencyRequirement, ResolutionResult, ResolvedDependency } from './DependencyTypes.js';

export class DependencyResolver {
  constructor(private readonly gitClient: GitClient) {}

  async resolve(rootManifest: UAPKGManifest, manifests: UAPKGManifest[]): Promise<ResolutionResult> {
    const requirements = this.collectRequirements(manifests);
    const pins = rootManifest.type === 'project' ? (rootManifest.overrides ?? []) : [];
    const warnings: string[] = [];
    const resolved: ResolvedDependency[] = [];

    for (const [name, packageRequirements] of requirements.entries()) {
      const pinned = this.findPin(pins, name);
      if (pinned) {
        const hash = await this.resolveHash(pinned.source, pinned.version);
        const dependencies = this.resolveDependenciesForPackage(manifests, name, pinned.source);
        resolved.push({
          name,
          source: pinned.source,
          version: pinned.version,
          hash,
          dependencies,
        });
        continue;
      }

      const uniqueSources = [...new Set(packageRequirements.map((req) => req.source))];
      if (uniqueSources.length > 1) {
        throw new Error(
          `[uapkg] Dependency '${name}' was requested from multiple sources: ${uniqueSources.join(', ')}. Add overrides entry in root uapkg.json.`,
        );
      }

      const source = uniqueSources[0];
      const versions = packageRequirements.map((req) => req.version).filter((value): value is string => Boolean(value));
      const chosenVersion = await this.resolveVersionForSource(name, source, versions, warnings);
      const hash = await this.resolveHash(source, chosenVersion);
      const dependencies = this.resolveDependenciesForPackage(manifests, name, source);

      if (versions.length > 1) {
        warnings.push(
          `[uapkg] Version conflict for '${name}' resolved to '${chosenVersion ?? 'default branch'}'. Requested: ${versions.join(', ')}`,
        );
      }

      resolved.push({ name, source, version: chosenVersion, hash, dependencies });
    }

    return { resolvedDependencies: resolved, warnings };
  }

  private collectRequirements(manifests: UAPKGManifest[]) {
    const requirements = new Map<string, DependencyRequirement[]>();
    for (const manifest of manifests) {
      for (const dependency of manifest.dependencies ?? []) {
        const entries = requirements.get(dependency.name) ?? [];
        entries.push({
          name: dependency.name,
          source: dependency.source,
          version: dependency.version,
          requestedBy: manifest.name,
        });
        requirements.set(dependency.name, entries);
      }
    }
    return requirements;
  }

  private findPin(pins: DependencyOverride[], name: string) {
    return pins.find((pin) => pin.name === name);
  }

  private async resolveVersionForSource(name: string, source: string, versions: string[], warnings: string[]) {
    if (versions.length === 0) {
      return 'HEAD';
    }

    const semverVersions = versions
      .map((value) => semver.clean(value))
      .filter((value): value is string => Boolean(value))
      .sort(semver.rcompare);
    if (semverVersions.length > 0) {
      return semverVersions[0];
    }

    const hasRangeRequest = versions.some((value) => value.includes('^') || value.includes('~') || value === '*');
    if (hasRangeRequest) {
      const refs = await this.gitClient.listRemoteRefs(source);
      const tagVersions = refs
        .filter((ref) => ref.kind === 'tag')
        .map((ref) => semver.clean(ref.name))
        .filter((value): value is string => Boolean(value))
        .sort(semver.rcompare);
      if (tagVersions.length > 0) {
        if (versions.includes('*')) {
          return tagVersions[0];
        }
        for (const requestedVersion of versions) {
          if (!semver.validRange(requestedVersion)) {
            continue;
          }
          const match = tagVersions.find((tagVersion) => semver.satisfies(tagVersion, requestedVersion));
          if (match) {
            return match;
          }
        }
        return tagVersions[0];
      }
    }

    warnings.push(
      `[uapkg] Could not semver-resolve versions for '${name}'. Falling back to '${versions[versions.length - 1]}'.`,
    );
    return versions[versions.length - 1];
  }

  private async resolveHash(source: string, version: string | undefined) {
    if (source.startsWith('file:')) {
      return 'local';
    }
    const resolved = await this.gitClient.resolveRef(source, version);
    return resolved.hash;
  }

  private resolveDependenciesForPackage(manifests: UAPKGManifest[], name: string, source: string) {
    void source;
    const selectedManifest = manifests.find((manifest) => manifest.name === name);
    return (selectedManifest?.dependencies ?? []).map((dependency) => dependency.name);
  }
}
