import type { SyncDecision, SyncPolicyInput } from '../contracts/RegistryCoreTypes.js';

/**
 * Determines whether a registry should be updated.
 *
 * Rules (evaluated in order):
 *   1. If `forced`, always update.
 *   2. If already updated within the current process lifetime, skip.
 *   3. If last sync was within TTL window, skip.
 *   4. Otherwise, update.
 */
export function evaluateSyncPolicy(input: SyncPolicyInput): SyncDecision {
  if (input.forced) {
    return 'update';
  }

  if (input.hasUpdatedWithinProcessLifetime) {
    return 'skip';
  }

  if (input.lastSyncAt !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const elapsed = nowSeconds - input.lastSyncAt;
    if (elapsed < input.ttlSeconds) {
      return 'skip';
    }
  }

  return 'update';
}
