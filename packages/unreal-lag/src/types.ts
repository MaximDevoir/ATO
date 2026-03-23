export interface CommonNetworkOptions {
  enabled?: boolean;
  lossPct?: number;
  duplicationPct?: number;
  latencyMs?: number;
  jitterMs?: number;
  latencyMinMs?: number;
  latencyMaxMs?: number;
}

export interface NetworkProfile {
  name: string;
  inbound: CommonNetworkOptions;
  outbound: CommonNetworkOptions;
}

export interface PeerSelection {
  profile?: string;
  inbound?: Partial<CommonNetworkOptions>;
  outbound?: Partial<CommonNetworkOptions>;
}

export interface ResolvedDirectionalNetworkOptions {
  enabled: boolean;
  lossPct: number;
  duplicationPct: number;
  latencyMs: number;
  jitterMs: number;
  latencyMinMs?: number;
  latencyMaxMs?: number;
}

export interface ResolvedPeerConfig {
  id: string;
  inbound: ResolvedDirectionalNetworkOptions;
  outbound: ResolvedDirectionalNetworkOptions;
}

export interface ServerTargetConfig {
  id?: string;
  address: string;
  port: number;
  selection?: PeerSelection;
}

export interface UnrealLagLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface UnrealLagOptions {
  bindAddress?: string;
  bindPort: number;
  server: ServerTargetConfig;
  defaultClient?: PeerSelection;
  predefinedClients?: Record<string, PeerSelection>;
  profiles?: Record<string, NetworkProfile>;
  autoCreateClients?: boolean;
  randomSeed?: number;
  logger?: UnrealLagLogger;
  verboseDebug: boolean;
}

export interface PeerEndpoint {
  address: string;
  port: number;
}

export type PeerKind = 'server' | 'client';

export interface RuntimePeerSummary {
  id: string;
  kind: PeerKind;
  endpoint?: PeerEndpoint;
  generation: number;
  active: boolean;
}

export interface PeerStats {
  received: number;
  forwarded: number;
  dropped: number;
  duplicated: number;
}

export interface UnrealLagStatsSnapshot {
  received: number;
  forwarded: number;
  dropped: number;
  duplicated: number;
  scheduled: number;
  released: number;
  peerAdded: number;
  peerRemoved: number;
  droppedUnknownPeer: number;
  droppedPeerRemoved: number;
  peers: Record<string, PeerStats>;
}

export interface RouteDecision {
  drop: boolean;
  duplicateCount: number;
  totalDelayMs: number;
  outboundDelayMs: number;
  inboundDelayMs: number;
}

export interface BindInfo {
  address: string;
  port: number;
}
