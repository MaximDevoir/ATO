# ATO

`@maximdevoir/ato` provides TypeScript helpers for orchestrating ATC processes.

## Highlights

- orchestrator-first native ATC runs
- on-demand external client spin-up driven by server log metadata
- optional `UnrealLag` proxy integration

## Install

```bash
pnpm add @maximdevoir/ato
```

## Usage

```ts
import {ATO, Orchestrator, OrchestratorMode} from '@maximdevoir/ato';

const e2e = ATO.fromCommandLine();

const dedicated = new Orchestrator(OrchestratorMode.DedicatedServer)
  .addTests('MyAwesomeProject.Category.Name')
  .configureUnrealLag({
    bindAddress: '127.0.0.1',
    bindPort: 0,
    serverProfile: 'Bad',
    clientProfile: 'Bad',
  });

e2e.addOrchestrator(dedicated);

const code = await e2e.start();

process.exit(code);
```

`ATO.fromCommandLine()` still accepts runtime overrides such as `--clients`, `--port`, `--timeout`, `--serverExe`,
`--clientExe`, and `--dryRun`.
For native dedicated/listen orchestrators, omitting `--clients` allows ATO to spawn external clients on demand as the
server requests them.
You can call `addOrchestrator(...)` multiple times to run several native orchestrators sequentially from one top-level
ATO session.
