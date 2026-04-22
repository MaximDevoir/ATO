import * as path from 'node:path';
import type { InstallPlan } from '@uapkg/installer';
import type { Lockfile, Manifest } from '@uapkg/package-manifest-schema';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { PostinstallCandidate } from '../postinstall/runner/PostinstallOrchestrator.js';

/**
 * Builds the {@link PostinstallCandidate} list that the postinstall
 * orchestrator consumes after an installer run.
 *
 * Rules:
 *   * Only `add` and `update` actions produce candidates (unchanged/remove never run postinstall).
 *   * `pluginRoot` is derived from the action's declared install `path` resolved
 *     against the manifest root — matching what the extractor wrote to disk.
 *   * `registry` is sourced from the lockfile entry; if the lockfile lacks the
 *     package (shouldn't happen post-install, but be defensive), the action is
 *     dropped.
 *
 * This adapter lives in the CLI rather than in `@uapkg/uapkg/postinstall/`
 * to keep the postinstall subsystem independent of `@uapkg/installer`.
 */
export class PostinstallCandidateBuilder {
  public build(root: CompositionRoot, plan: InstallPlan, lockfile: Lockfile): PostinstallCandidate[] {
    const lockPackages = lockfile.packages as Record<string, { registry: string }>;
    const candidates: PostinstallCandidate[] = [];
    for (const action of plan.actions) {
      if (action.type !== 'add' && action.type !== 'update') continue;
      const locked = lockPackages[action.packageName];
      const registry = locked?.registry ?? action.registry;
      if (!registry) continue;
      candidates.push({
        packageName: action.packageName,
        registry: registry as string,
        pluginRoot: path.join(root.cwd, action.path),
      });
    }
    return candidates;
  }

  /** Convenience: returns `'project' | 'plugin'` for the orchestrator's input. */
  public resolveManifestType(manifest: Manifest): 'project' | 'plugin' {
    return manifest.kind === 'project' ? 'project' : 'plugin';
  }
}

