import { UnrealLagProfiles } from './profiles.js';
import type { RandomSource } from './random.js';
import type {
  CommonNetworkOptions,
  NetworkProfile,
  PeerSelection,
  ResolvedDirectionalNetworkOptions,
  ResolvedPeerConfig,
  RouteDecision,
} from './types.js';

function clampPct(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clampMs(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return Math.max(0, value);
}

function mergeCommon(
  base: CommonNetworkOptions | undefined,
  override: Partial<CommonNetworkOptions> | undefined,
): CommonNetworkOptions {
  return {
    ...base,
    ...override,
  };
}

function resolveDirection(direction: CommonNetworkOptions | undefined): ResolvedDirectionalNetworkOptions {
  const latencyMinMs = clampMs(direction?.latencyMinMs);
  const latencyMaxMs = clampMs(direction?.latencyMaxMs);

  let resolvedMin = latencyMinMs;
  let resolvedMax = latencyMaxMs;
  if (resolvedMin !== undefined || resolvedMax !== undefined) {
    resolvedMin = resolvedMin ?? 0;
    resolvedMax = Math.max(resolvedMin, resolvedMax ?? resolvedMin);
  }

  return {
    enabled: direction?.enabled ?? true,
    lossPct: clampPct(direction?.lossPct),
    duplicationPct: clampPct(direction?.duplicationPct),
    latencyMs: Math.max(0, direction?.latencyMs ?? 0),
    jitterMs: Math.max(0, direction?.jitterMs ?? 0),
    latencyMinMs: resolvedMin,
    latencyMaxMs: resolvedMax,
  };
}

export function resolvePeerSelection(
  id: string,
  selection: PeerSelection | undefined,
  profiles: Record<string, NetworkProfile> | undefined,
): ResolvedPeerConfig {
  const profileMap: Record<string, NetworkProfile> = {
    ...UnrealLagProfiles,
    ...(profiles ?? {}),
  };
  const profileName = selection?.profile;
  const profile = profileName ? profileMap[profileName] : undefined;

  return {
    id,
    inbound: resolveDirection(mergeCommon(profile?.inbound, selection?.inbound)),
    outbound: resolveDirection(mergeCommon(profile?.outbound, selection?.outbound)),
  };
}

export function sampleDelayMs(rules: ResolvedDirectionalNetworkOptions, random: RandomSource): number {
  if (!rules.enabled) return 0;

  if (rules.latencyMinMs !== undefined || rules.latencyMaxMs !== undefined) {
    const min = rules.latencyMinMs ?? 0;
    const max = Math.max(min, rules.latencyMaxMs ?? min);
    return random.intInclusive(min, max);
  }

  if (rules.jitterMs > 0) {
    const delta = random.intInclusive(-rules.jitterMs, rules.jitterMs);
    return Math.max(0, rules.latencyMs + delta);
  }

  return rules.latencyMs;
}

export function evaluateRoute(
  sender: ResolvedPeerConfig,
  receiver: ResolvedPeerConfig,
  random: RandomSource,
): RouteDecision {
  const outbound = sender.outbound;
  const inbound = receiver.inbound;

  const drop =
    (outbound.enabled && random.chancePct(outbound.lossPct)) || (inbound.enabled && random.chancePct(inbound.lossPct));

  const duplicateCount = outbound.enabled && random.chancePct(outbound.duplicationPct) ? 2 : 1;
  const outboundDelayMs = sampleDelayMs(outbound, random);
  const inboundDelayMs = sampleDelayMs(inbound, random);

  return {
    drop,
    duplicateCount,
    outboundDelayMs,
    inboundDelayMs,
    totalDelayMs: outboundDelayMs + inboundDelayMs,
  };
}
