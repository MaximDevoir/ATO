import semver from 'semver';
import type { DependencyPin, UAPMManifest } from '../domain/UAPMManifest';
import type { GitClient } from '../services/GitClient';
import type { DependencyRequirement, ResolutionResult, ResolvedDependency } from './DependencyTypes';

export class DependencyResolver {
  constructor(private readonly gitClient: GitClient) {}

  async resolve(rootManifest: UAPMManifest, manifests: UAPMManifest[]): Promise<ResolutionResult> {
    const requirements = this.collectRequirements(manifests);
    const pins = rootManifest.dependencyPins ?? [];
    const warnings: string[] = [];
    const resolved: ResolvedDependency[] = [];

    for (const [name, packageRequirements] of requirements.entries()) {
      const pinned = this.findPin(pins, name);
      if (pinned) {
        resolved.push({
          name,
          source: pinned.source,
          version: pinned.version,
        });
        continue;
      }

      const uniqueSources = [...new Set(packageRequirements.map((req) => req.source))];
      if (uniqueSources.length > 1) {
        throw new Error(
          `[uapm] Dependency '${name}' was requested from multiple sources: ${uniqueSources.join(', ')}. Add dependencyPins entry in root uapm.json.`,
        );
      }

      const source = uniqueSources[0];
      const versions = packageRequirements.map((req) => req.version).filter((value): value is string => Boolean(value));
      const chosenVersion = await this.resolveVersionForSource(name, source, versions, warnings);

      if (versions.length > 1) {
        warnings.push(
          `[uapm] Version conflict for '${name}' resolved to '${chosenVersion ?? 'default branch'}'. Requested: ${versions.join(', ')}`,
        );
      }

      resolved.push({ name, source, version: chosenVersion });
    }

    return { resolvedDependencies: resolved, warnings };
  }

  private collectRequirements(manifests: UAPMManifest[]) {
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

  private findPin(pins: DependencyPin[], name: string) {
    return pins.find((pin) => pin.name === name);
  }

  private async resolveVersionForSource(name: string, source: string, versions: string[], warnings: string[]) {
    if (versions.length === 0) {
      return undefined;
    }

    const semverVersions = versions
      .map((value) => semver.clean(value))
      .filter((value): value is string => Boolean(value))
      .sort(semver.rcompare);
    if (semverVersions.length > 0) {
      return semverVersions[0];
    }

    // Best effort fallback when values are non-semver (hash/branch/range).
    // Prefer the most recently discovered git tag if any requested ref looks like range.
    if (versions.some((value) => value.includes('^') || value.includes('~') || value === '*')) {
      const refs = await this.gitClient.listRemoteRefs(source);
      const tags = refs
        .filter((ref) => ref.kind === 'tag')
        .map((ref) => semver.clean(ref.name))
        .filter(Boolean) as string[];
      if (tags.length > 0) {
        return tags.sort(semver.rcompare)[0];
      }
    }

    warnings.push(
      `[uapm] Could not semver-resolve versions for '${name}'. Falling back to '${versions[versions.length - 1]}'.`,
    );
    return versions[versions.length - 1];
  }
}
