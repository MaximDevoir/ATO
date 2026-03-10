# UnrealLag

`UnrealLag` is a standalone UDP network emulation proxy for multiplayer CI tests.

It uses `node:dgram`, runs as one proxy process, supports one server + a dynamic number of clients, and applies network
conditions using:

- sender outbound rules
- receiver inbound rules
- a fixed priority marker that bypasses emulation entirely when present anywhere in the packet payload

So for any packet from `peerA -> peerB`:

```ts
finalDelay = sample(peerA.outbound) + sample(peerB.inbound)
```

> Priority packets are the exception: if UnrealLag finds the 8-byte marker anywhere in the UDP payload, it forwards the
> packet immediately and skips loss, duplication, latency, jitter, and scheduler delay.

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

## Peer lifecycle

- A `Peer` is any process connection to the poxy. This includes the server and any client.
- Clients are auto-created on the first packet by default.
- Each auto-created client gets its own upstream socket to the real server.
- Any in-transit packets for a removed peer are dropped when they reach the scheduler release point.

## Priority packets

Use this exact 8-byte marker anywhere inside the UDP payload when a packet must bypass UnrealLag emulation:

`0xB7 0x86 0x12 0x26 0xF9 0x11 0xE4 0x4E`

Detection rules:

- UnrealLag reads each packet payload for the priority marker.
- Priority packets are forwarded immediately and unchanged; the marker is not stripped.
- Priority packets bypass packet loss, duplication, latency, jitter, and scheduler delay in both directions.
- Normal peer validation still applies.

## Orchestrator integration

The multiplayer orchestrator starts `UnrealLag` automatically, then points clients at the proxy endpoint instead of the
real server. The current runner integration configures both server and client sides through profiles in code.

## Notes

- `UnrealLag` does not expose a CLI. Use the API programmatically.
- `exampleConfig.ts` is the canonical sample configuration module.
- This is a UDP emulator, not a TCP simulator.
