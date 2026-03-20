#!/usr/bin/env node
import { ATO, Coordinator, CoordinatorMode } from '@maximdevoir/ato';

const ATCPIETest = ATO.fromCommandLine();
const coordinator = new Coordinator(CoordinatorMode.PIE).addTests().configureUnrealLag({
  bindAddress: '127.0.0.1',
  bindPort: 0,
  serverProfile: 'Bad',
  clientProfile: 'Bad',
});

coordinator.addTests('ATC.AssetAudits');

ATCPIETest.addCoordinator(coordinator);
const code = await ATCPIETest.start();
process.exit(code);
