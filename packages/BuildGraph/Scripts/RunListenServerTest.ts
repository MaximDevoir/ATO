#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCListenServerTest = ATO.fromCommandLine();

const orchestrator = new Orchestrator(OrchestratorMode.ListenServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

orchestrator.addTests('ATC.AssetAudits');
orchestrator.addTests('ATC.ORCHESTRATOR_LISTEN');

ATCListenServerTest.addOrchestrator(orchestrator);

const code = await ATCListenServerTest.start();
process.exit(code);
