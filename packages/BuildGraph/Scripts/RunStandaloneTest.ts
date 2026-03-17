#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCStandaloneTest = ATO.fromCommandLine();

const standaloneOrchestrator = new Orchestrator(OrchestratorMode.Standalone);
ATCStandaloneTest.addOrchestrator(standaloneOrchestrator);

const code = await ATCStandaloneTest.start();
process.exit(code);
