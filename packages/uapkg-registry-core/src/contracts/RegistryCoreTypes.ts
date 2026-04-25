import type { RegistryIdentifier, UnixTimestamp } from '@uapkg/common-schema';

// ---------------------------------------------------------------------------
// Registry descriptor — normalized description of a registry identity
// ---------------------------------------------------------------------------

export interface RegistryDescriptor {
  readonly type: 'git';
  readonly url: string;
  readonly ref: {
    readonly type: 'branch' | 'tag' | 'rev';
    readonly value: string;
  };
}

// ---------------------------------------------------------------------------
// Registry sync
// ---------------------------------------------------------------------------

export type RegistryUpdateResult = 'Updated' | 'AlreadyFresh' | 'UpdatedRecently' | 'Failed';

export interface RegistryUpdateOptions {
  /** Skip the TTL freshness check and force a sync. */
  readonly bypassFreshnessCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Registry metadata (registry.json in cache root)
// ---------------------------------------------------------------------------

export interface RegistryMetadata {
  readonly lastRegistrySyncAt: UnixTimestamp;
  readonly registryIdentifier: RegistryIdentifier;
}

// ---------------------------------------------------------------------------
// Registry lock file shape
// ---------------------------------------------------------------------------

export interface RegistryLockData {
  readonly pid: number;
  readonly startedAt: UnixTimestamp;
  readonly heartbeat: UnixTimestamp;
}

// ---------------------------------------------------------------------------
// Sync policy
// ---------------------------------------------------------------------------

export interface SyncPolicyInput {
  readonly lastSyncAt: UnixTimestamp | undefined;
  readonly ttlSeconds: number;
  readonly hasUpdatedWithinProcessLifetime: boolean;
  readonly forced: boolean;
}

export type SyncDecision = 'update' | 'skip';

// ---------------------------------------------------------------------------
// Instantiation
// ---------------------------------------------------------------------------

export type RegistryInstantiationResult = 'Created' | 'AlreadyInstantiated' | 'Failed';

export interface RegistryCoreOptions {
  /** Pass a `@uapkg/config` ConfigInstance to avoid re-reading config. */
  readonly configInstance?: {
    get(path?: string, options?: { scope?: 'global' | 'local' }): unknown;
    getAll(): Record<string, unknown>;
    getDefaultRegistry(): { url: string; ref: { type: string; value: string } } | null;
  };
}
