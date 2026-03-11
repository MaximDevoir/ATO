# UnrealLag

`UnrealLag` is a standalone UDP network emulation proxy for multiplayer CI tests.

It uses `node:dgram`, runs as one proxy process, supports one server + a dynamic number of clients, and applies network
conditions using:

- sender outbound rules
- receiver inbound rules

So for any packet from `peerA -> peerB`:

```ts
finalDelay = sample(peerA.outbound) + sample(peerB.inbound)
```

## Goals

- Cross-platform UDP proxy for CI
- One proxy process
- Support any number of peers. One server + N clients or client-to-clients, etc.
- Preset network profiles and custom profiles

## Profiles

`profiles.ts` contains named presets such as:

- `NoLag`
- `Good`
- `Average`
- `Bad`
- `Mobile`
- `Satellite`

Peers are configured directly through those profiles and optional partial overrides.

## Network Stability Warning

When using UnrealLag with the Awesome Test Coordinator (ATC), high-latency or
high-loss profiles can cause coordination messages to arrive very slowly or be
dropped entirely. Call `logWarningIfNetworkProfileUnstable(profile)` at startup
to get a heads-up when a profile exceeds safe thresholds (packet loss > 15%,
latency > 200 ms, or duplication > 5%).

## Peer lifecycle

- A `Peer` is any process connection to the proxy. This includes the server and any client.
- Clients are auto-created on the first packet by default.
- Each auto-created client gets its own upstream socket to the real server.
- Any in-transit packets for a removed peer are dropped when they reach the scheduler release point.


## Orchestrator integration

The multiplayer orchestrator starts `UnrealLag` automatically, then points clients at the proxy endpoint instead of the
real server. The current runner integration configures both server and client sides through profiles in code.

## Notes

- `UnrealLag` does not expose a CLI. Use the API programmatically.
- `exampleConfig.ts` is the canonical sample configuration module.
- This is a UDP emulator, not a TCP simulator.
