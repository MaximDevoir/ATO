import type { NetworkProfile, UnrealLagLogger } from './types.js';

export const UnrealLagProfiles = {
  NoLag: {
    name: 'NoLag',
    inbound: { enabled: false, lossPct: 0, duplicationPct: 0, latencyMs: 0, jitterMs: 0 },
    outbound: { enabled: false, lossPct: 0, duplicationPct: 0, latencyMs: 0, jitterMs: 0 },
  },

  LAN: {
    name: 'LAN',
    inbound: { enabled: true, lossPct: 0, duplicationPct: 0, latencyMs: 2, jitterMs: 1 },
    outbound: { enabled: true, lossPct: 0, duplicationPct: 0, latencyMs: 2, jitterMs: 1 },
  },

  Good: {
    name: 'Good',
    inbound: { enabled: true, lossPct: 0.05, duplicationPct: 0, latencyMs: 30, jitterMs: 5 },
    outbound: { enabled: true, lossPct: 0.05, duplicationPct: 0, latencyMs: 35, jitterMs: 6 },
  },

  Average: {
    name: 'Average',
    inbound: { enabled: true, lossPct: 0.5, duplicationPct: 0, latencyMs: 80, jitterMs: 20 },
    outbound: { enabled: true, lossPct: 0.6, duplicationPct: 0, latencyMs: 90, jitterMs: 25 },
  },

  Bad: {
    name: 'Bad',
    inbound: { enabled: true, lossPct: 3, duplicationPct: 0.2, latencyMs: 160, jitterMs: 60 },
    outbound: { enabled: true, lossPct: 4, duplicationPct: 0.3, latencyMs: 190, jitterMs: 70 },
  },

  Mobile: {
    name: 'Mobile',
    inbound: { enabled: true, lossPct: 2, duplicationPct: 0.1, latencyMs: 110, jitterMs: 35 },
    outbound: { enabled: true, lossPct: 2.5, duplicationPct: 0.15, latencyMs: 130, jitterMs: 40 },
  },

  SatelliteLEO: {
    name: 'SatelliteLEO',
    inbound: { enabled: true, lossPct: 0.5, duplicationPct: 0, latencyMs: 60, jitterMs: 20 },
    outbound: { enabled: true, lossPct: 0.6, duplicationPct: 0, latencyMs: 70, jitterMs: 25 },
  },

  SatelliteGEO: {
    name: 'SatelliteGEO',
    inbound: { enabled: true, lossPct: 1, duplicationPct: 0, latencyMs: 650, jitterMs: 120 },
    outbound: { enabled: true, lossPct: 1.2, duplicationPct: 0, latencyMs: 670, jitterMs: 130 },
  },

  MoonLink: {
    name: 'MoonLink',
    inbound: { enabled: true, latencyMs: 1280, jitterMs: 30, lossPct: 0.05, duplicationPct: 0 },
    outbound: { enabled: true, latencyMs: 1280, jitterMs: 30, lossPct: 0.05, duplicationPct: 0 },
  },
  MarsLink: {
    name: 'MarsLink',
    inbound: { enabled: true, latencyMs: 720000, jitterMs: 60000, lossPct: 0.1, duplicationPct: 0 },
    outbound: { enabled: true, latencyMs: 720000, jitterMs: 60000, lossPct: 0.1, duplicationPct: 0 },
  },
} satisfies Record<string, NetworkProfile>;

export type UnrealLagBuiltinProfileName = keyof typeof UnrealLagProfiles;
export type UnrealLagProfileName = UnrealLagBuiltinProfileName | (string & {});

/**
 * Logs a warning if the given network profile has conditions that may cause
 * Automated Test Coordinator (ATC) communication between server and clients
 * to be unreliable or very slow.
 *
 * Thresholds:
 *  - Packet loss > 15%
 *  - Latency > 200 ms
 *  - Duplication (used here as a proxy for packet-drop churn) > 5%
 *
 * Call this once per profile at startup (e.g. in the UnrealLag constructor or
 * orchestrator boot) so CI operators get an early heads-up.
 */
export function logWarningIfNetworkProfileUnstable(profile: NetworkProfile, logger: UnrealLagLogger = console): void {
  const issues: string[] = [];

  for (const dir of ['inbound', 'outbound'] as const) {
    const opts = profile[dir];
    if (!opts.enabled) continue;

    if ((opts.lossPct ?? 0) > 15) {
      issues.push(`${dir} packet loss ${opts.lossPct}% > 15%`);
    }
    if ((opts.latencyMs ?? 0) > 200) {
      issues.push(`${dir} latency ${opts.latencyMs}ms > 200ms`);
    }
    if ((opts.duplicationPct ?? 0) > 5) {
      issues.push(`${dir} duplication ${opts.duplicationPct}% > 5%`);
    }
  }

  if (issues.length > 0) {
    logger.warn(
      `[UnrealLag] Network profile '${profile.name}' may be unstable for ATC coordination: ${issues.join('; ')}. ` +
        'Awesome Test Coordinator communication between server and clients are connected to the proxy and ' +
        'test updates within the testing framework may be waiting a long time to receive updates.',
    );
  }
}
