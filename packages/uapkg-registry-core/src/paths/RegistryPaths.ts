import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Pure path helpers for registry cache layout.
 *
 * Layout:
 *   ~/.uapkg/registry/{shortId}/
 *     registry.json
 *     registry/          ← cloned registry repo
 *     packages/           ← cached tgz files
 */

const UAPKG_DIR = '.uapkg';
const REGISTRY_DIR = 'registry';

/** Root of all registry caches: `~/.uapkg/registry` */
export function getRegistryRoot(): string {
  return join(homedir(), UAPKG_DIR, REGISTRY_DIR);
}

/** Cache root for a specific registry: `~/.uapkg/registry/{shortId}` */
export function getRegistryCachePath(shortId: string): string {
  return join(getRegistryRoot(), shortId);
}

/** Path to the cloned registry repo. */
export function getRegistryRepoPath(shortId: string): string {
  return join(getRegistryCachePath(shortId), REGISTRY_DIR);
}

/** Path to the cached packages directory. */
export function getRegistryPackagesPath(shortId: string): string {
  return join(getRegistryCachePath(shortId), 'packages');
}

/** Path to `registry.json` metadata file. */
export function getRegistryMetadataPath(shortId: string): string {
  return join(getRegistryCachePath(shortId), 'registry.json');
}

/** Path to the lock file used during updates. */
export function getRegistryLockPath(shortId: string): string {
  return join(getRegistryCachePath(shortId), '.lock');
}
