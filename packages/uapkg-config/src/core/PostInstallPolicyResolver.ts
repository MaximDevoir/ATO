import type { PostInstallPolicyValue, ResolvedConfig } from '../contracts/ConfigTypes.js';

/**
 * Resolves the effective `PostInstallPolicy` for a given install action.
 *
 * Resolution order (nearest wins):
 *   1. `registries.<registryName>.postInstallPolicy` (if defined)
 *   2. `install.postInstallPolicy` (global default, which itself defaults to `deny`)
 *
 * Whichever level provided the value is reported via `resolvedFrom` so that
 * consumers (e.g. `POSTINSTALL_POLICY_DENIED` diagnostics) can point the user
 * at the correct config key.
 */
export class PostInstallPolicyResolver {
  public resolve(
    config: ResolvedConfig,
    registryName: string,
  ): { policy: PostInstallPolicyValue; resolvedFrom: 'registry' | 'install' } {
    const registry = config.registries[registryName];
    if (registry?.postInstallPolicy !== undefined) {
      return { policy: registry.postInstallPolicy, resolvedFrom: 'registry' };
    }
    return { policy: config.install.postInstallPolicy, resolvedFrom: 'install' };
  }
}
