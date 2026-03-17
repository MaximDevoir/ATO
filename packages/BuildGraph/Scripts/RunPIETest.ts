#!/usr/bin/env node
import path from 'node:path';
import { ATO, Orchestrator, OrchestratorMode } from '@maximdevoir/ato';

const ATCPIETest = ATO.fromCommandLine();
const pieOrchestrator = new Orchestrator(OrchestratorMode.PIE)
  .addTests()
  .configureUnrealLag({
    bindAddress: '127.0.0.1',
    bindPort: 0,
    serverProfile: 'Bad',
    clientProfile: 'Bad',
  })
  .configureRuntime({
    serverExe: path.join(ATCPIETest.ueRoot, 'Binaries', 'Win64', 'UnrealEditor.exe'),
  });

ATCPIETest.addOrchestrator(pieOrchestrator);

const code = await ATCPIETest.start();

process.exit(code);
