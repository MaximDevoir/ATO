#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCPIETest = ATO.fromCommandLine();
const orchestrator = new Orchestrator(OrchestratorMode.PIE).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

orchestrator.addTests('ATC.AssetAudits');

ATCPIETest.addOrchestrator(orchestrator);
const code = await ATCPIETest.start();
process.exit(code);
