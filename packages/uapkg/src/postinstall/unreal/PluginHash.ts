import { createHash } from 'node:crypto';

/** Deterministic 8-char SHA-1 hash of a plugin name; used for uniquely-named helper classes. */
export function getPluginHash(pluginName: string): string {
  return createHash('sha1').update(pluginName).digest('hex').slice(0, 8).toLowerCase();
}

/**
 * Name of the nested helper class uapkg injects into a Build.cs / Target.cs.
 * Hashed so two plugins can never collide inside the same module or target.
 */
export function getWrapperClassName(pluginName: string): string {
  return `UAPKG_${getPluginHash(pluginName)}`;
}
