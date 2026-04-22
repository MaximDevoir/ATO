import type { AssetHash, InstallPath, PackageName, PackageVersion, RegistryName } from '@uapkg/common-schema';

/**
 * The kind of change the installer will perform for a single package.
 */
export type InstallActionType = 'add' | 'update' | 'remove' | 'unchanged';

/**
 * A single planned action — fully self-describing so the executor does not
 * need to re-query the lockfile or registry at execution time.
 */
export interface InstallAction {
  readonly type: InstallActionType;
  readonly packageName: PackageName;
  readonly path: InstallPath;
  /** Target version (for add / update / unchanged). */
  readonly targetVersion?: PackageVersion;
  /** Previously installed version (for update / remove). */
  readonly currentVersion?: PackageVersion;
  readonly registry?: RegistryName;
  readonly integrity?: AssetHash;
  /** Byte size of the .tgz asset, if known from the registry manifest. */
  readonly sizeBytes?: number;
  /** Asset download URL for add / update. */
  readonly downloadUrl?: string;
}

/**
 * Summary counts for the whole plan.
 */
export interface InstallSummary {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly totalBytes: number;
}

/**
 * The full plan returned by `InstallPlanner.plan()`. Safe to serialize
 * (e.g. for `--dry-run --json`).
 */
export interface InstallPlan {
  readonly actions: readonly InstallAction[];
  readonly summary: InstallSummary;
}

/**
 * Options accepted by {@link Installer}. Concurrency is NOT accepted here —
 * the installer reads `network.maxConcurrentDownloads` from config.
 */
export interface InstallerOptions {
  /** Absolute path to the directory containing `uapkg.json`. */
  readonly manifestRoot: string;
  /** If true, safety policies emit `SAFETY_OVERRIDDEN_BY_FORCE` instead of failing. */
  readonly force?: boolean;
  /** If true, the plan is produced but no IO is performed. */
  readonly dryRun?: boolean;
}

