# UnrealTestOrchestrator

`@UMaestro/UnrealTestOrchestrator` provides TypeScript helpers for orchestrating Unreal server/client processes in
multiplayer automation runs.

## Highlights

- optional `UnrealLag` proxy integration
-

## Install

```bash
pnpm add @UMaestro/UnrealTestOrchestrator
```

## Usage

```ts
import {RuntimePresets, UnrealTestOrchestrator} from '@UMaestro/UnrealTestOrchestrator';

const e2e = UnrealTestOrchestrator.fromCommandLine();
const server = RuntimePresets.Server(e2e.projectPath);

server.execTests.push('MyAwesomeProject.Category.Name');
e2e.configureServer(server);

const client = RuntimePresets.Client(e2e.projectPath);
e2e.addClient(client);

const code = await e2e.start();

process.exit(code);
```
