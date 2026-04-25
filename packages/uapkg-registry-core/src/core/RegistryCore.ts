import { computeRegistryIdentifier, computeRegistryIdentifierShort } from '@uapkg/common';
import type { RegistryIdentifier } from '@uapkg/common-schema';
import { ConfigInstance } from '@uapkg/config';
import { createRegistryNotFoundDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { RegistryCoreOptions, RegistryDescriptor } from '../contracts/RegistryCoreTypes.js';
import { Registry } from '../registry/Registry.js';

/**
 * Top-level entry point for the registry subsystem.
 *
 * Manages a process-level cache of `Registry` instances and resolves
 * configured registry names into runtime `Registry` objects.
 */
export class RegistryCore {
  private static readonly registryPool = new Map<string, Registry>();
  private readonly registries = new Map<string, Registry>();
  private readonly config: InstanceType<typeof ConfigInstance>;

  constructor(options: RegistryCoreOptions = {}) {
    this.config = (options.configInstance as InstanceType<typeof ConfigInstance>) ?? new ConfigInstance();
  }

  /**
   * Get or create a `Registry` for the given logical name.
   *
   * The name must exist as a key under `registries` in the resolved config.
   */
  getOrCreateRegistry(registryName: string): Result<Registry> {
    // Return cached instance
    const existing = this.registries.get(registryName);
    if (existing) return ok(existing);

    const bag = new DiagnosticBag();

    // Resolve descriptor from config
    const descriptor = this.resolveDescriptor(registryName);
    if (!descriptor) {
      bag.add(createRegistryNotFoundDiagnostic(registryName));
      return bag.toFailure();
    }

    const id = computeRegistryIdentifier(descriptor) as RegistryIdentifier;
    const shortId = computeRegistryIdentifierShort(descriptor);
    const gitBinary = (this.config.get('git') as string) ?? 'git';
    const globalTtl = (this.config.get('registryCache.ttlSeconds') as number) ?? 300;

    // per-registry ttlSeconds override
    const perRegistryTtl = this.config.get(`registries.${registryName}.ttlSeconds`) as number | null;
    const ttl = perRegistryTtl ?? globalTtl;

    const globalKey = id;
    const shared = RegistryCore.registryPool.get(globalKey);
    if (shared) {
      shared.registerAlias(registryName, ttl);
      this.registries.set(registryName, shared);
      return ok(shared);
    }

    const registry = Registry.create(registryName, descriptor, id, shortId, gitBinary, ttl);
    RegistryCore.registryPool.set(globalKey, registry);
    this.registries.set(registryName, registry);

    return ok(registry);
  }

  /** Resolve a registry descriptor from config. */
  private resolveDescriptor(registryName: string): RegistryDescriptor | null {
    const url = this.config.get(`registries.${registryName}.url`) as string | null;
    if (!url) return null;

    const refType = (this.config.get(`registries.${registryName}.ref.type`) as string) ?? 'branch';
    const refValue = (this.config.get(`registries.${registryName}.ref.value`) as string) ?? 'main';

    return {
      type: 'git',
      url,
      ref: {
        type: refType as 'branch' | 'tag' | 'rev',
        value: refValue,
      },
    };
  }
}
