import type { CoordinatorMode } from './ATO.options';

export const ATC_RUN_TESTS_COMMAND = 'ATC.RunTests';
export const ATC_CLIENT_BOOTSTRAP_TEST = 'ATC.ClientBootstrap';
export const ATC_CLIENT_BOOTSTRAP_FINISH_TEST = 'ZZZ.ATC.ClientBootstrap.Finish';
export const MAX_EXPLICIT_ATC_CLIENT_BOOTSTRAP_CLIENTS = 32;
export const ATC_CLIENT_REQUEST_LOG_PREFIX = '[ATC_CLIENT_REQUEST]';

export const ATC_ORCHESTRATOR_TESTS = {
  DedicatedServer: 'ZZZ.ATC.Orchestrator.DedicatedServer',
  ListenServer: 'ZZZ.ATC.Orchestrator.ListenServer',
  Standalone: 'ZZZ.ATC.Orchestrator.Standalone',
  PIE: 'ZZZ.ATC.Orchestrator.PIE',
} as const satisfies Record<CoordinatorMode, string>;

export function getATCIndexedClientBootstrapTest(clientIndex: number) {
  return `${ATC_CLIENT_BOOTSTRAP_TEST}.${clientIndex}`;
}

export function isATCClientBootstrapTestName(execTest: string) {
  return execTest === ATC_CLIENT_BOOTSTRAP_TEST || execTest.startsWith(`${ATC_CLIENT_BOOTSTRAP_TEST}.`);
}
