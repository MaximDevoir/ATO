# ATI

Awesome Test Insights is a lightweight TCP event router for ATC coordinator telemetry.

## What it does

- listens for newline-delimited UTF-8 JSON events over TCP
- validates the incoming event envelope
- fans events out to one or more in-process consumers
- keeps consumer delivery isolated with per-consumer queues

ATI is intentionally **not** a database. Persistence is delegated to consumers such as `NDJSONConsumer`.

## Event transport

Each payload is one JSON object followed by a newline:

```json
{"version":1,"sessionId":"...","sequence":0,"timestamp":1.23,"type":"TestStarted","testPath":"ATC.Sample"}
```

## Quick example

```ts
import { ATIService, NDJSONConsumer, TerminalConsumer } from '@maximdevoir/ati';

const ati = new ATIService({
  host: '127.0.0.1',
  port: 8888,
  validateSchema: true,
});

ati
  .addConsumer(new NDJSONConsumer({ directory: './Saved/Logs/ATI' }))
  .addConsumer(new TerminalConsumer());

await ati.start();

console.log('ATI listening on', ati.getEndpoint());

// ...run ATC/ATO here...

await ati.stop();
```

## Built-in consumers

- `NDJSONConsumer` – appends events to an `.ndjson` file
- `TerminalConsumer` – prints a small human-readable summary
- `InMemoryConsumer` – useful in tests

