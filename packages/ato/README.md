# ATO

`@UMaestro/ATO` provides TypeScript helpers for orchestrating ATC processes.

## Highlights

- optional `UnrealLag` proxy integration
-

## Install

```bash
pnpm add @UMaestro/ATO
```

## Usage

```ts
import {ATO, RuntimePresets} from '@UMaestro/ATO';

const e2e = ATO.fromCommandLine();
const server = RuntimePresets.Server(e2e.projectPath);

server.execTests.push('MyAwesomeProject.Category.Name');
e2e.configureServer(server);

const client = RuntimePresets.Client(e2e.projectPath);
e2e.addClient(client);

const code = await e2e.start();

process.exit(code);
```
