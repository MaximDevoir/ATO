#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCDedicatedTest = ATO.fromCommandLine();

const dedicatedOrchestrator = new Orchestrator(OrchestratorMode.DedicatedServer).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

ATCDedicatedTest.addOrchestrator(dedicatedOrchestrator);

const code = await ATCDedicatedTest.start();
process.exit(code);
