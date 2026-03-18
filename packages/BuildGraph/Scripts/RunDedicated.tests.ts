#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCDedicatedTest = ATO.fromCommandLine();

const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

orchestrator.addTests('ATC.AssetAudits');
orchestrator.addTests('ATC.ORCHESTRATOR_DEDICATED');

ATCDedicatedTest.addOrchestrator(orchestrator);

const code = await ATCDedicatedTest.start();
process.exit(code);
