#!/usr/bin/env node
import {ATO, Orchestrator, OrchestratorMode} from '@maximdevoir/ato';

const ATCListenServerTest = ATO.fromCommandLine();

const listenOrchestrator = new Orchestrator(OrchestratorMode.ListenServer)
    .addTests()
    .configureUnrealLag({
        bindAddress: '127.0.0.1',
        bindPort: 0,
        serverProfile: 'Bad',
        clientProfile: 'Bad',
    });

ATCListenServerTest.addOrchestrator(listenOrchestrator);

const code = await ATCListenServerTest.start();
process.exit(code);


