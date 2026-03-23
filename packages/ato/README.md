# ATO

`@maximdevoir/ato` provides TypeScript helpers for orchestrating ATC processes.

## Highlights

- coordinator-first native ATC runs
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
`--clientExe`, `--dryRun`, and `--codecov`.
For native dedicated/listen coordinators, omitting `--clients` allows ATO to spawn external clients on demand as the
server requests them.
When `--codecov` is enabled, ATO wraps each spawned Unreal process with OpenCppCoverage, writes LCOV output to
`coverage/atc/<coordinator-or-client>.lcov.info`, and defaults coverage collection to project-owned modules/sources
instead of Unreal Engine modules.
For coordinator-driven external client spin-up, ATO now listens for direct ATI `TestStarted.requiredClients` events and
keeps the legacy stdout metadata parsing as a compatibility fallback, so client orchestration still works when stdout is
wrapped by tools such as OpenCppCoverage.
You can call `addOrchestrator(...)` multiple times to run several native coordinators sequentially from one top-level
ATO session.
