import { getExampleConfig } from './exampleConfig.js';
import type { PeerSelection, ServerTargetConfig, UnrealLagOptions } from './types.js';
import { UnrealLag } from './UnrealLag.js';

function mergeSelection(
  base: PeerSelection | undefined,
  override: PeerSelection | undefined,
): PeerSelection | undefined {
  if (!base && !override) return undefined;
  if (!base) return { ...override };
  if (!override) return { ...base };
  return {
    ...base,
    ...override,
  };
}

function mergeServer(base: ServerTargetConfig, override: Partial<ServerTargetConfig> | undefined): ServerTargetConfig {
  if (!override) {
    return {
      ...base,
      selection: mergeSelection(base.selection, undefined),
    };
  }

  return {
    ...base,
    ...override,
    selection: mergeSelection(base.selection, override.selection),
  };
}

function mergeExampleOptions(overrides?: Partial<UnrealLagOptions>): UnrealLagOptions {
  const base = getExampleConfig();
  return {
    ...base,
    ...overrides,
    server: mergeServer(base.server, overrides?.server),
    defaultClient: mergeSelection(base.defaultClient, overrides?.defaultClient),
  };
}

export function createExampleUnrealLag(overrides?: Partial<UnrealLagOptions>) {
  return new UnrealLag(mergeExampleOptions(overrides));
}
