import type { PackageVersion, VersionRange } from '@uapkg/common-schema';
import semver from 'semver';

/**
 * npm-style version selection policy.
 *
 * Rules (matching npm's resolver behavior via `semver`):
 *
 *  1. A range that does not explicitly include a prerelease tag
 *     (e.g. `^1.0.0`) will never auto-select a prerelease version.
 *  2. A range with an explicit prerelease tag (e.g. `^1.0.0-0`,
 *     `>=1.0.0-beta.1`) opts-in to prereleases via `includePrerelease`.
 *  3. If the current installed version is a prerelease and a stable
 *     version satisfies the range, the stable version wins — users
 *     should escape the prerelease channel as soon as possible.
 *  4. All other ties are broken by `semver.rcompare` (highest wins).
 *
 * This class is pure: no IO, no shared state.
 */
export class SemverSelectionPolicy {
  /**
   * Select the best matching version.
   *
   * @param candidates All versions available in the registry manifest.
   * @param range The semver range from the dependency declaration.
   * @param current The version already installed/locked, if any. Used to
   *   bias escape-from-prerelease (rule #3).
   * @returns The best matching version, or `null` if nothing satisfies.
   */
  selectBest(
    candidates: readonly PackageVersion[],
    range: VersionRange,
    current?: PackageVersion,
  ): PackageVersion | null {
    if (candidates.length === 0) return null;

    const includePrerelease = this.rangeExplicitlyOptsInToPrerelease(range as unknown as string);
    const currentIsPrerelease = current !== undefined && this.isPrerelease(current as unknown as string);

    const satisfying = candidates
      .filter((v) => semver.satisfies(v as unknown as string, range as unknown as string, { includePrerelease }))
      .slice()
      .sort((a, b) => semver.rcompare(a as unknown as string, b as unknown as string));

    if (satisfying.length === 0) return null;

    // Rule 1+2: if the range does not opt-in, strip prereleases unless the
    // ONLY matches are prereleases. `semver.satisfies` with
    // `includePrerelease: false` already excludes prereleases unless the
    // range specifies one — but be defensive.
    if (!includePrerelease) {
      const stable = satisfying.filter((v) => !this.isPrerelease(v as unknown as string));
      if (stable.length > 0) return stable[0];
    }

    // Rule 3: when the user is stuck on a prerelease but a stable satisfies
    // the range, prefer the stable.
    if (currentIsPrerelease) {
      const stable = satisfying.find((v) => !this.isPrerelease(v as unknown as string));
      if (stable) return stable;
    }

    return satisfying[0];
  }

  /** Does the range string itself mention a prerelease tag? */
  private rangeExplicitlyOptsInToPrerelease(range: string): boolean {
    // Heuristic identical to npm's — presence of a hyphen inside a comparator
    // signals a prerelease anchor. e.g. `^1.0.0-0`, `>=2.0.0-beta.1`.
    return /\d+\.\d+\.\d+-[0-9A-Za-z.+-]+/.test(range);
  }

  /** Is the given version string a prerelease? */
  private isPrerelease(version: string): boolean {
    const pre = semver.prerelease(version);
    return pre !== null && pre.length > 0;
  }
}

