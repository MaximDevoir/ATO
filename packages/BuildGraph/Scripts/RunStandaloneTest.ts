#!/usr/bin/env node
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCStandaloneTest = ATO.fromCommandLine();

const orchestrator = new Orchestrator(OrchestratorMode.Standalone);

orchestrator.addTests('ATC.AssetAudits');
orchestrator.addTests('ATC.STANDALONE_MODE');

ATCStandaloneTest.addOrchestrator(orchestrator);
const code = await ATCStandaloneTest.start();
process.exit(code);
