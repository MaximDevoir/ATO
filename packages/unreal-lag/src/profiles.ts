import type { NetworkProfile } from './types';

export const UnrealLagProfiles = {
  NoLag: {
    name: 'NoLag',
    inbound: { enabled: true, lossPct: 0, duplicationPct: 0, latencyMs: 0, jitterMs: 0 },
    outbound: { enabled: true, lossPct: 0, duplicationPct: 0, latencyMs: 0, jitterMs: 0 },
  },
  Good: {
    name: 'Good',
    inbound: { enabled: true, lossPct: 0.1, duplicationPct: 0, latencyMs: 30, jitterMs: 5 },
    outbound: { enabled: true, lossPct: 0.1, duplicationPct: 0, latencyMs: 30, jitterMs: 5 },
  },
  Average: {
    name: 'Average',
    inbound: { enabled: true, lossPct: 1, duplicationPct: 0, latencyMs: 80, jitterMs: 20 },
    outbound: { enabled: true, lossPct: 1, duplicationPct: 0, latencyMs: 80, jitterMs: 20 },
  },
  Bad: {
    name: 'Bad',
    inbound: { enabled: true, lossPct: 5, duplicationPct: 0.2, latencyMs: 200, jitterMs: 50 },
    outbound: { enabled: true, lossPct: 5, duplicationPct: 0.2, latencyMs: 200, jitterMs: 50 },
  },
  Mobile: {
    name: 'Mobile',
    inbound: { enabled: true, lossPct: 2, duplicationPct: 0.1, latencyMs: 120, jitterMs: 35 },
    outbound: { enabled: true, lossPct: 2, duplicationPct: 0.1, latencyMs: 120, jitterMs: 35 },
  },
  Satellite: {
    name: 'Satellite',
    inbound: { enabled: true, lossPct: 1, duplicationPct: 0, latencyMs: 650, jitterMs: 120 },
    outbound: { enabled: true, lossPct: 1, duplicationPct: 0, latencyMs: 650, jitterMs: 120 },
  },
} satisfies Record<string, NetworkProfile>;

export type UnrealLagBuiltinProfileName = keyof typeof UnrealLagProfiles;
export type UnrealLagProfileName = UnrealLagBuiltinProfileName | (string & {});
