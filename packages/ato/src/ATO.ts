// TODO: Support Linux/macOS. Right now Win64 and .exe is hardcoded a lot.
import type { ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { type ATCEvent, ATIService, type IATIConsumer, NDJSONConsumer, TerminalConsumer } from '@maximdevoir/ati';
import { logWarningIfNetworkProfileUnstable, UnrealLagProfiles } from '@maximdevoir/unreal-lag/profiles';
import type { BindInfo } from '@maximdevoir/unreal-lag/types';
import { UnrealLag } from '@maximdevoir/unreal-lag/UnrealLag';
import isInteractive from 'is-interactive';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ATC_CLIENT_REQUEST_LOG_PREFIX, ATC_RUN_TESTS_COMMAND } from './ATCAutomationNames';
import { checkExistsSync } from './ATO._helpers';
import {
  buildCoverageWrappedLaunch,
  isCodeCoverageExecutableAvailable,
  resolveCodeCoverageExecutable,
} from './ATO.codecov';
import { killProcessTree, spawnProcess, waitForUdpPortFromProcessTree } from './ATO.helpers';
import type {
  ATIEndpointOptions,
  ATINDJSONConsumerOptions,
  ATIRuntimeOptions,
  ATIServiceOptions,
  ATOReporterMode,
  ClientOptions,
  E2ECommandLineContext,
  E2ECommandLineOptions,
  E2ERuntimeOptions,
  ProcessLaunchOptions,
  ServerOptions,
  UnrealLagProxyOptions,
} from './ATO.options';
import { CoordinatorMode, RuntimePresets } from './ATO.options';
import { createATORunOutput } from './ATORunOutput';
import { FrameworkValidationReporter, formatFrameworkValidationSummaryLines } from './FrameworkValidationReporter';

export * from './ATCAutomationNames';
export { ATC_RUN_TESTS_COMMAND } from './ATCAutomationNames';
export { CoordinatorMode, RuntimePresets } from './ATO.options';
export * from './FrameworkValidationReporter';

interface ATOInit {
  runtimeOptions?: E2ERuntimeOptions;
  commandLineContext?: E2ECommandLineContext;
  atiOptions?: ATIRuntimeOptions;
}

interface ResolvedServerOptions extends ServerOptions {
  exe: string;
}

interface ResolvedClientOptions extends ClientOptions {
  clientIndex: number;
  exe: string;
  host: string;
}

interface ResolvedClientTemplate extends ClientOptions {
  exe: string;
  host: string;
}

interface ResolvedPreviewCommand {
  exe: string;
  args: string[];
  command: string;
}

interface PreparedProcessLaunch extends ResolvedPreviewCommand {
  reportFilePath?: string;
  waitForDescendantProcessPortBinding?: boolean;
}

interface ResolvedPreview {
  server: ResolvedPreviewCommand;
  clients: ResolvedPreviewCommand[];
  clientTemplate?: ResolvedPreviewCommand;
  maxExternalClients?: number | 'unbounded';
  unrealLag?: {
    bindAddress: string;
    bindPort: number;
    serverProfile: string;
    clientProfile: string;
    targetServerPort: number;
    timeoutSeconds: number;
  };
}

interface ResolvedLaunchPlan {
  effectivePort: number;
  // The number of seconds we will wait for each process (server and clients) to boot up and signal to the test
  // coordinator within ATC that they are ready to begin testing.
  effectiveTimeout: number;
  server: ResolvedServerOptions;
  clientTemplate?: ResolvedClientTemplate;
  atcCoordinatorMode: CoordinatorMode;
  maxExternalClients?: number;
  preview: ResolvedPreview;
  dryRun: boolean;
  codecovEnabled: boolean;
  unrealLagOptions?: UnrealLagProxyOptions;
}

interface ResolvedATIServiceOptions {
  label: string;
  host: string;
  port: number;
  connectTimeoutSeconds: number;
  validateSchema: boolean;
  maxEventSizeBytes: number;
  ndjson: false | Required<ATINDJSONConsumerOptions>;
  terminal: boolean;
}

interface StartedATIService {
  label: string;
  endpoint: ATIEndpointOptions;
  service: ATIService;
}

interface ParsedCommandLineArguments {
  ATODebug: boolean;
  UERoot: string;
  Project: string;
  clients?: number;
  port?: number;
  timeout?: number;
  serverExe?: string;
  clientExe?: string;
  dryRun: boolean;
  codecov: boolean;
  updateSnapshots: boolean;
  reporter: ATOReporterMode;
}

export interface ATCClientRequestMetadata {
  testPath: string;
  requiredClients: number;
}

interface ATCObservationState {
  requestedRemoteClients: number;
}

function applyATCRequestedRemoteClients(state: ATCObservationState, requiredClients: number) {
  state.requestedRemoteClients = Math.max(state.requestedRemoteClients, requiredClients);
}

export function observeATCSpawnRequestEvent(
  state: Pick<ATCObservationState, 'requestedRemoteClients'>,
  event: Pick<ATCEvent, 'type' | 'requiredClients' | 'processRole'>,
) {
  if (event.type !== 'TestStarted') {
    return;
  }

  if (event.processRole && event.processRole !== 'Coordinator') {
    return;
  }

  if (
    typeof event.requiredClients !== 'number' ||
    !Number.isInteger(event.requiredClients) ||
    event.requiredClients < 0
  ) {
    return;
  }

  state.requestedRemoteClients = Math.max(state.requestedRemoteClients, event.requiredClients);
}

class ATOSpawnControlConsumer implements IATIConsumer {
  readonly id = 'ato-spawn-control';

  constructor(private readonly state: ATCObservationState) {}

  onEvent(event: ATCEvent) {
    observeATCSpawnRequestEvent(this.state, event);
  }
}

const FAILURE_EXIT_CODE = 1;

type ProcessExitResult = number | 'timeout';
type ATCRunTestsMode = CoordinatorMode | 'Client';

type AutomationTerminalResult = 'Success' | 'Fail' | 'Error' | 'NotRun' | 'Unknown';

export interface AutomationCompletedTest {
  result: AutomationTerminalResult;
  name: string;
  path: string;
}

export interface AutomationObservationState {
  expectAutomation: boolean;
  sawReadyToStartAutomation: boolean;
  foundTests: number | null;
  testsPerformed: number | null;
  sawQueueEmpty: boolean;
  queuedTests: number;
  enabledTests: number | null;
  atcCompletionExitCode: number | null;
  successfulTests: number;
  unsuccessfulTests: AutomationCompletedTest[];
}

interface MonitoredProcess {
  label: string;
  process: ChildProcess;
  automation: AutomationObservationState;
  atc: ATCObservationState;
  exitPromise: Promise<ProcessExitResult>;
  waitForDescendantProcessPortBinding?: boolean;
}

interface ProcessOutcome {
  label: string;
  rawExitResult: ProcessExitResult;
  effectiveExitCode: number;
  reason: string;
  automation: AutomationObservationState;
}

function promiseProcessExitOrTimeout(
  processHandle: ChildProcess,
  timeoutSeconds: number,
  onTimeout: () => void,
  onProcessError: (error: Error) => void = (error) => console.error('Process error', error),
) {
  return new Promise<ProcessExitResult>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout();
      } catch {}
      resolve('timeout');
    }, timeoutSeconds * 1000);

    processHandle.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(typeof code === 'number' ? code : 0);
    });

    processHandle.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onProcessError(error);
      resolve(-1);
    });
  });
}

export function createAutomationObservationState(expectAutomation: boolean): AutomationObservationState {
  return {
    expectAutomation,
    sawReadyToStartAutomation: false,
    foundTests: null,
    testsPerformed: null,
    sawQueueEmpty: false,
    queuedTests: 0,
    enabledTests: null,
    atcCompletionExitCode: null,
    successfulTests: 0,
    unsuccessfulTests: [],
  };
}

function stripLogTimePrefix(line: string) {
  return line.replace(/^\[\d{1,2}:\d{2}:\d{2} [AP]M]\s*/, '');
}

const foundAutomationTestsPattern =
  /LogAutomationCommandLine:\s+Display:\s+Found\s+(\d+)\s+automation tests based on\s+'/i;
const automationReadyPattern = /LogAutomationCommandLine:\s+Display:\s+Ready to start automation/i;
const automationQueueEmptyPattern =
  /LogAutomationCommandLine:\s+Display:\s+\.\.\.Automation Test Queue Empty\s+(\d+)\s+tests performed\./i;
const automationCompletedPattern =
  /LogAutomationController:\s+(?:Display|Error):\s+Test Completed\. Result=\{([^}]*)}\s+Name=\{([^}]*)}\s+Path=\{([^}]*)}/i;
const atcQueuedTestPattern = /\[ATC]\s+Queue\s+(.+)$/i;
const atcEnabledTestsPattern = /\[ATC]\s+Enabling\s+(\d+)\s+tests via AutomationController/i;
const atcCompletionExitCodePattern = /\[ATC]\s+\*{4}\s+TEST COMPLETE\. EXIT CODE:\s+(-?\d+)\s+\*{4}/i;
const clientLabelPattern = /^CLIENT\s+(\d+)$/i;

function toAutomationTerminalResult(rawResult: string): AutomationTerminalResult {
  switch (rawResult.trim()) {
    case 'Success':
      return 'Success';
    case 'Fail':
      return 'Fail';
    case 'Error':
      return 'Error';
    case 'NotRun':
      return 'NotRun';
    default:
      return 'Unknown';
  }
}

function applyFoundTestsLogLine(state: AutomationObservationState, normalized: string) {
  const match = foundAutomationTestsPattern.exec(normalized);
  if (!match) {
    return;
  }
  state.foundTests = Number.parseInt(match[1] ?? '', 10);
}

function applyReadyToStartAutomationLogLine(state: AutomationObservationState, normalized: string) {
  if (automationReadyPattern.test(normalized)) {
    state.sawReadyToStartAutomation = true;
  }
}

function applyQueueEmptyLogLine(state: AutomationObservationState, normalized: string) {
  const match = automationQueueEmptyPattern.exec(normalized);
  if (!match) {
    return;
  }
  state.sawQueueEmpty = true;
  state.testsPerformed = Number.parseInt(match[1] ?? '', 10);
}

function applyCompletedTestLogLine(state: AutomationObservationState, normalized: string) {
  const match = automationCompletedPattern.exec(normalized);
  if (!match) {
    return;
  }

  const terminalResult = toAutomationTerminalResult(match[1] ?? '');
  if (terminalResult === 'Success') {
    state.successfulTests += 1;
    return;
  }

  state.unsuccessfulTests.push({
    result: terminalResult,
    name: (match[2] ?? '').trim(),
    path: (match[3] ?? '').trim(),
  });
}

function applyATCQueuedTestLogLine(state: AutomationObservationState, normalized: string) {
  if (!atcQueuedTestPattern.test(normalized)) {
    return;
  }

  state.queuedTests += 1;
  if (state.foundTests === null || state.foundTests < state.queuedTests) {
    state.foundTests = state.queuedTests;
  }
}

function applyATCEnabledTestsLogLine(state: AutomationObservationState, normalized: string) {
  const match = atcEnabledTestsPattern.exec(normalized);
  if (!match) {
    return;
  }

  const enabledTests = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(enabledTests)) {
    return;
  }

  state.enabledTests = enabledTests;
  if (state.foundTests === null) {
    state.foundTests = enabledTests;
  }
}

function applyATCCompletionLogLine(state: AutomationObservationState, normalized: string) {
  const match = atcCompletionExitCodePattern.exec(normalized);
  if (!match) {
    return;
  }

  const exitCode = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(exitCode)) {
    return;
  }

  state.atcCompletionExitCode = exitCode;
}

function getCompletedAutomationCount(state: AutomationObservationState) {
  return state.successfulTests + state.unsuccessfulTests.length;
}

function getObservedAutomationTotal(state: AutomationObservationState) {
  const completedCount = getCompletedAutomationCount(state);
  if (state.testsPerformed !== null) {
    return state.testsPerformed;
  }
  if (completedCount > 0) {
    return completedCount;
  }
  if (state.enabledTests !== null) {
    return state.enabledTests;
  }
  if (state.foundTests !== null) {
    return state.foundTests;
  }
  return state.queuedTests > 0 ? state.queuedTests : null;
}

function inferAutomationFailureReason(state: AutomationObservationState) {
  const failedResult = state.unsuccessfulTests[0]?.result;
  if (failedResult) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: `automation completed with result ${failedResult}`,
    };
  }

  const observedTotal = getObservedAutomationTotal(state);
  if ((state.foundTests !== null && state.foundTests <= 0) || (observedTotal !== null && observedTotal <= 0)) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: 'no matching automation tests were found',
    };
  }

  if (state.atcCompletionExitCode !== null && state.atcCompletionExitCode !== 0) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: `automation reported exit code ${state.atcCompletionExitCode}`,
    };
  }

  return undefined;
}

export function observeAutomationLogLine(state: AutomationObservationState, line: string) {
  if (!state.expectAutomation) {
    return;
  }

  const normalized = stripLogTimePrefix(line);
  applyReadyToStartAutomationLogLine(state, normalized);
  applyFoundTestsLogLine(state, normalized);
  applyQueueEmptyLogLine(state, normalized);
  applyCompletedTestLogLine(state, normalized);
  applyATCQueuedTestLogLine(state, normalized);
  applyATCEnabledTestsLogLine(state, normalized);
  applyATCCompletionLogLine(state, normalized);
}

export function parseATCClientRequestMetadataLine(line: string): ATCClientRequestMetadata | undefined {
  const normalized = stripLogTimePrefix(line);
  const prefixIndex = normalized.indexOf(ATC_CLIENT_REQUEST_LOG_PREFIX);
  if (prefixIndex < 0) {
    return undefined;
  }

  const payload = normalized.slice(prefixIndex + ATC_CLIENT_REQUEST_LOG_PREFIX.length).trim();
  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<ATCClientRequestMetadata>;
    const testPath = typeof parsed.testPath === 'string' ? parsed.testPath.trim() : '';
    const requiredClients =
      typeof parsed.requiredClients === 'number' &&
      Number.isInteger(parsed.requiredClients) &&
      parsed.requiredClients >= 0
        ? parsed.requiredClients
        : undefined;
    if (!testPath || requiredClients === undefined) {
      return undefined;
    }

    return {
      testPath,
      requiredClients,
    };
  } catch {
    return undefined;
  }
}

export function getAutomationTotals(state: AutomationObservationState) {
  const completedCount = getCompletedAutomationCount(state);
  const total = getObservedAutomationTotal(state) ?? completedCount;
  const passed = Math.min(state.successfulTests, total);
  return {
    passed,
    total,
  };
}

function formatAutomationSuccessReason(testsPerformed: number | null) {
  if (testsPerformed === null) {
    return 'automation passed';
  }
  const suffix = testsPerformed === 1 ? '' : 's';
  return `automation passed (${testsPerformed} test${suffix} performed)`;
}

function hasTerminalAutomationResult(automation: AutomationObservationState) {
  return (
    automation.unsuccessfulTests.length > 0 || automation.sawQueueEmpty || automation.atcCompletionExitCode !== null
  );
}

function resolveProcessOutcome(rawExitResult: ProcessExitResult, automation: AutomationObservationState) {
  if (automation.expectAutomation && hasTerminalAutomationResult(automation)) {
    const inferredFailure = inferAutomationFailureReason(automation);
    if (inferredFailure) {
      return inferredFailure;
    }

    const observedTotal = getObservedAutomationTotal(automation);
    if (observedTotal === null) {
      return {
        effectiveExitCode: FAILURE_EXIT_CODE,
        reason:
          automation.atcCompletionExitCode !== null
            ? 'automation completion did not report how many tests ran'
            : 'automation queue did not report tests performed',
      };
    }
    if (observedTotal <= 0) {
      return {
        effectiveExitCode: FAILURE_EXIT_CODE,
        reason: 'automation queue completed with 0 tests performed',
      };
    }

    return {
      effectiveExitCode: 0,
      reason: formatAutomationSuccessReason(observedTotal),
    };
  }

  if (rawExitResult === 'timeout') {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: 'process timed out',
    };
  }
  if (rawExitResult !== 0) {
    return {
      effectiveExitCode: rawExitResult,
      reason: `process exited with code ${rawExitResult}`,
    };
  }
  if (!automation.expectAutomation) {
    return {
      effectiveExitCode: 0,
      reason: 'process exited cleanly',
    };
  }

  const inferredFailure = inferAutomationFailureReason(automation);
  if (inferredFailure) {
    return inferredFailure;
  }
  if (!automation.sawQueueEmpty) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: 'automation queue did not finish',
    };
  }
  const observedTotal = getObservedAutomationTotal(automation);
  if (observedTotal === null) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: 'automation queue did not report tests performed',
    };
  }
  if (observedTotal <= 0) {
    return {
      effectiveExitCode: FAILURE_EXIT_CODE,
      reason: 'automation queue completed with 0 tests performed',
    };
  }

  return {
    effectiveExitCode: 0,
    reason: formatAutomationSuccessReason(observedTotal),
  };
}

export function resolveProcessExitCode(rawExitResult: ProcessExitResult, automation: AutomationObservationState) {
  return resolveProcessOutcome(rawExitResult, automation).effectiveExitCode;
}

export function resolveProcessExitReason(rawExitResult: ProcessExitResult, automation: AutomationObservationState) {
  return resolveProcessOutcome(rawExitResult, automation).reason;
}

function summarizeProcessOutcome(
  label: string,
  rawExitResult: ProcessExitResult,
  automation: AutomationObservationState,
): ProcessOutcome {
  const resolved = resolveProcessOutcome(rawExitResult, automation);
  return {
    label,
    rawExitResult,
    effectiveExitCode: resolved.effectiveExitCode,
    reason: resolved.reason,
    automation,
  };
}

function summarizeStartupFailureOutcome(
  label: string,
  rawExitResult: ProcessExitResult,
  automation: AutomationObservationState,
  status: number | 'timeout' | 'bind-failed',
): ProcessOutcome {
  const effectiveExitCode = rawExitResult === 'timeout' || rawExitResult === 0 ? FAILURE_EXIT_CODE : rawExitResult;
  let reason = 'exited before binding UDP port';
  if (status === 'bind-failed') {
    reason = 'failed to bind UDP port';
  } else if (status === 'timeout') {
    reason = 'startup timeout';
  }

  return {
    label,
    rawExitResult,
    effectiveExitCode,
    reason,
    automation,
  };
}

function formatRuntimeIdentifier(label: string) {
  if (label === 'DEDICATED') {
    return 'Dedicated';
  }
  if (label === 'LISTEN') {
    return 'Listen';
  }
  if (label === 'STANDALONE') {
    return 'Standalone';
  }
  if (label === 'PIE') {
    return 'PIE';
  }
  if (label === 'SERVER') {
    return 'Server';
  }
  const match = clientLabelPattern.exec(label);
  if (match) {
    return `Client ${match[1]}`;
  }
  return label;
}

function formatExitReason(reason: string) {
  if (reason === 'process exited cleanly') {
    return 'clean';
  }
  if (reason.startsWith('automation passed')) {
    return 'passed';
  }
  return reason;
}

function formatProcessExitLine(outcome: ProcessOutcome) {
  return `${formatRuntimeIdentifier(outcome.label).padEnd(10, ' ')} | ${outcome.effectiveExitCode} | ${formatExitReason(outcome.reason)}`;
}

export function formatAutomationSummaryLine(label: string, automation: AutomationObservationState) {
  if (!automation.expectAutomation) {
    return undefined;
  }
  const totals = getAutomationTotals(automation);
  return `${formatRuntimeIdentifier(label)} | Passed ${totals.passed}/${totals.total}`;
}

function formatUnsuccessfulAutomationTestLine(label: string, test: AutomationCompletedTest) {
  return `${formatRuntimeIdentifier(label)} | Result={${test.result}} Name={${test.name}} Path={${test.path}}`;
}

function printOrchestrationSummary(outcomes: ProcessOutcome[], writeLine: (line: string) => void) {
  if (outcomes.length === 0) {
    return;
  }
  writeLine('Orchestration Complete');

  const automationOutcomes = outcomes.filter((outcome) => outcome.automation.expectAutomation);
  if (automationOutcomes.length > 0) {
    writeLine('Test Summary');
    for (const outcome of automationOutcomes) {
      const summaryLine = formatAutomationSummaryLine(outcome.label, outcome.automation);
      if (summaryLine) {
        writeLine(summaryLine);
      }
      for (const test of outcome.automation.unsuccessfulTests) {
        writeLine(formatUnsuccessfulAutomationTestLine(outcome.label, test));
      }
    }
    writeLine('');
  }

  writeLine('Exit Codes');
  for (const outcome of outcomes) {
    writeLine(formatProcessExitLine(outcome));
  }
}

function hasAutomationCommands(launchOptions: Pick<ProcessLaunchOptions, 'execTests' | 'execCmds'>) {
  if ((launchOptions.execTests?.length ?? 0) > 0) {
    return true;
  }

  return (launchOptions.execCmds ?? []).some((command) =>
    /\b(?:Automation\s+RunTests?|ATC\.RunTests)\b/i.test(command),
  );
}

function normalizeATCRunTestsPattern(testName: string) {
  const trimmed = testName.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutExactSuffix = trimmed.endsWith('$') ? trimmed.slice(0, -1) : trimmed;
  return withoutExactSuffix.includes('*') ? withoutExactSuffix : `${withoutExactSuffix}*`;
}

function buildExecTestsCommand(execTests?: string[], mode?: ATCRunTestsMode, clientIndex?: number) {
  const formattedTests = (execTests ?? [])
    .map((testName) => testName.trim())
    .filter((testName) => testName.length > 0)
    .map(normalizeATCRunTestsPattern)
    .filter((testName): testName is string => !!testName);

  if (formattedTests.length === 0 && !mode) {
    return undefined;
  }

  const args = [ATC_RUN_TESTS_COMMAND];
  if (mode) {
    args.push(`--mode=${mode}`);
    if (mode === 'Client' && clientIndex !== undefined && clientIndex >= 0) {
      args.push(`--clientIndex=${clientIndex}`);
    }
  }
  args.push(...formattedTests);
  return args.join(' ');
}

function buildExecCmdsArg(
  execCmds?: string[],
  execTests?: string[],
  mode?: ATCRunTestsMode,
  clientIndex?: number,
): string | undefined {
  const commands = (execCmds ?? []).filter((command) => command.trim().length > 0);
  const runTestsCommand = buildExecTestsCommand(execTests, mode, clientIndex);
  if (runTestsCommand) {
    commands.push(runTestsCommand);
  }
  if (commands.length === 0) return undefined;
  return commands.join('; ');
}

function quoteValue(value: string) {
  const escaped = value.replaceAll('"', String.raw`\"`);
  return `"${escaped}"`;
}

function formatCommand(exe: string | undefined, args: string[]) {
  const formattedArgs = args.map((arg) => {
    const equalsIndex = arg.indexOf('=');
    if (equalsIndex > 0) {
      const key = arg.slice(0, equalsIndex);
      const value = arg.slice(equalsIndex + 1);
      const lowerKey = key.toLowerCase();
      if (lowerKey === '-testexit' || lowerKey === '-execmds') {
        if (value.length === 0) return key;
        return `${key}=${quoteValue(value)}`;
      }
      if (/\s/.test(value)) {
        return `${key}=${quoteValue(value)}`;
      }
      return arg;
    }

    if (/\s/.test(arg) || arg === '') {
      return quoteValue(arg);
    }
    return arg;
  });

  return `${exe ?? '<unspecified-exe>'} ${formattedArgs.join(' ')}`.trim();
}

interface ParsedArgEntry {
  tokens: string[];
  optionName?: string;
}

const repeatableNamedOptions = new Set(['atiendpoint']);

function normalizeOptionName(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const firstToken = trimmed.split(/\s+/, 1)[0] ?? '';
  const tokenWithoutValue = firstToken.split('=', 1)[0] ?? '';
  const stripped = tokenWithoutValue.replace(/^-+/, '');
  if (!stripped) return undefined;

  if (tokenWithoutValue.startsWith('-')) {
    return stripped.toLowerCase();
  }

  if (/^[A-Za-z][A-Za-z0-9._-]*$/.test(stripped)) {
    return stripped.toLowerCase();
  }

  return undefined;
}

function hasInlineOptionValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const firstWhitespace = trimmed.search(/\s/);
  if (firstWhitespace <= 0) {
    return trimmed.includes('=');
  }
  return true;
}

function parseArgEntries(args: string[]): ParsedArgEntry[] {
  const entries: ParsedArgEntry[] = [];

  for (let index = 0; index < args.length; index++) {
    const current = args[index];
    const optionName = normalizeOptionName(current);
    if (!optionName) {
      entries.push({ tokens: [current] });
      continue;
    }

    const tokens = [current];
    const next = args[index + 1];
    const nextLooksLikeOption = next ? next.trim().startsWith('-') || hasInlineOptionValue(next) : false;
    if (!hasInlineOptionValue(current) && next !== undefined && !nextLooksLikeOption) {
      tokens.push(next);
      index += 1;
    }

    entries.push({ tokens, optionName });
  }

  return entries;
}

function filterExcludedArgEntries(entries: ParsedArgEntry[], excludeArgs: string[]) {
  const excludedOptionNames = new Set(
    excludeArgs.map(normalizeOptionName).filter((value): value is string => value !== undefined),
  );

  if (excludedOptionNames.size === 0) return entries;
  return entries.filter((entry) => !entry.optionName || !excludedOptionNames.has(entry.optionName));
}

function keepLastNamedArgEntries(entries: ParsedArgEntry[]) {
  const lastIndexByOption = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.optionName && !repeatableNamedOptions.has(entry.optionName)) {
      lastIndexByOption.set(entry.optionName, index);
    }
  });

  return entries.filter(
    (entry, index) =>
      !entry.optionName ||
      repeatableNamedOptions.has(entry.optionName) ||
      lastIndexByOption.get(entry.optionName) === index,
  );
}

function flattenArgEntries(entries: ParsedArgEntry[]) {
  return entries.flatMap((entry) => entry.tokens);
}

function resolveLaunchExtraArgs(launchOptions: ProcessLaunchOptions) {
  const parsedEntries = parseArgEntries(launchOptions.extraArgs ?? []);
  const filteredEntries = filterExcludedArgEntries(parsedEntries, launchOptions.excludeArgs ?? []);
  const dedupedEntries = keepLastNamedArgEntries(filteredEntries);
  return flattenArgEntries(dedupedEntries);
}

function dedupeFinalNamedArgs(positionals: string[], args: string[]) {
  const parsedEntries = parseArgEntries(args);
  const dedupedEntries = keepLastNamedArgEntries(parsedEntries);
  return positionals.concat(flattenArgEntries(dedupedEntries));
}

function appendResolvedExtraArgs(baseArgs: string[], extraArgs: string[]) {
  if (extraArgs.length === 0) {
    return [...baseArgs];
  }

  const positionals: string[] = [];
  for (const arg of baseArgs) {
    if (normalizeOptionName(arg) !== undefined) {
      break;
    }
    positionals.push(arg);
  }

  return dedupeFinalNamedArgs(positionals, baseArgs.slice(positionals.length).concat(extraArgs));
}

function sanitizeATIPathSegment(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'ATI';
}

function resolveATIRunLabel(mode: CoordinatorMode) {
  switch (mode) {
    case CoordinatorMode.DedicatedServer:
      return 'Dedicated';
    case CoordinatorMode.ListenServer:
      return 'Listen';
    case CoordinatorMode.Standalone:
      return 'Standalone';
    case CoordinatorMode.PIE:
      return 'PIE';
  }
}

function resolveATINDJSONDirectory(projectRoot: string, label: string, directory?: string) {
  if (!directory) {
    return path.join(projectRoot, 'Saved', 'Logs', 'ATI', sanitizeATIPathSegment(label));
  }

  return path.isAbsolute(directory) ? directory : path.join(projectRoot, directory);
}

function cloneATINDJSONConsumerOptions(
  options?: false | ATINDJSONConsumerOptions,
): false | ATINDJSONConsumerOptions | undefined {
  if (options === false) {
    return false;
  }

  if (!options) {
    return options;
  }

  return { ...options };
}

function cloneATIServiceOptions(options: ATIServiceOptions) {
  return {
    ...options,
    ...(options.ndjson !== undefined ? { ndjson: cloneATINDJSONConsumerOptions(options.ndjson) } : {}),
  } satisfies ATIServiceOptions;
}

function cloneATIRuntimeOptions(options?: ATIRuntimeOptions): ATIRuntimeOptions {
  if (!options) {
    return {};
  }

  return {
    ...options,
    ...(options.services ? { services: options.services.map(cloneATIServiceOptions) } : {}),
  };
}

function mergeATIRuntimeOptions(base: ATIRuntimeOptions | undefined, overrides?: ATIRuntimeOptions) {
  const clonedBase = cloneATIRuntimeOptions(base);
  const clonedOverrides = cloneATIRuntimeOptions(overrides);
  return {
    ...clonedBase,
    ...clonedOverrides,
    ...(clonedOverrides.services ? { services: clonedOverrides.services.map(cloneATIServiceOptions) } : {}),
  } satisfies ATIRuntimeOptions;
}

function formatATIEndpointArg(endpoint: ATIEndpointOptions) {
  const connectTimeoutSeconds = endpoint.connectTimeoutSeconds ?? 0.25;
  return `-ATIEndpoint=(Host="${endpoint.host}",Port=${endpoint.port},ConnectTimeoutSeconds=${connectTimeoutSeconds})`;
}

function buildATIReporterArgs(endpoints: ATIEndpointOptions[]) {
  if (endpoints.length === 0) {
    return [];
  }

  return ['-ATIEnableTcpReporting=1', ...endpoints.map((endpoint) => formatATIEndpointArg(endpoint))];
}

function resolveListenStartupUrl(startupMap: string | undefined) {
  if (!startupMap) {
    return undefined;
  }

  return startupMap.includes('?') ? `${startupMap}?listen` : `${startupMap}?listen`;
}

function buildServerArgs(
  serverOptions: ServerOptions,
  port?: number,
  atcCoordinatorMode: CoordinatorMode = CoordinatorMode.DedicatedServer,
) {
  const positionals = [serverOptions.project];
  if (atcCoordinatorMode === 'ListenServer') {
    const listenStartupUrl = resolveListenStartupUrl(serverOptions.startupMap);
    if (listenStartupUrl) {
      positionals.push(listenStartupUrl);
    }
  }

  // Clone configured extra args. For non-dedicated modes we need to ensure '-server' is removed
  // so that ListenServer / Standalone don't accidentally have both '-game' and '-server'.
  let extraArgs = [...(serverOptions.extraArgs ?? [])];
  if (atcCoordinatorMode !== 'DedicatedServer') {
    extraArgs = extraArgs.filter((a) => a !== '-server');
    if (atcCoordinatorMode !== 'PIE' && !extraArgs.includes('-game')) {
      extraArgs.unshift('-game');
    }
  }

  if (port !== undefined) {
    extraArgs.push(`-port=${port}`);
  }

  return buildProcessArgsWithATCRunTestsMode(
    positionals,
    {
      ...serverOptions,
      extraArgs,
    },
    shouldAutomaticallyApplyBootstrapTests(serverOptions) ? atcCoordinatorMode : undefined,
  );
}

function buildProcessArgsWithATCRunTestsMode(
  positionals: string[],
  launchOptions: ProcessLaunchOptions,
  mode?: ATCRunTestsMode,
  clientIndex?: number,
) {
  const args = positionals.concat(resolveLaunchExtraArgs(launchOptions));
  const execCmds = buildExecCmdsArg(launchOptions.execCmds, launchOptions.execTests, mode, clientIndex);
  if (execCmds) {
    args.push(`-ExecCmds=${execCmds}`);
  }
  if (launchOptions.testExit) {
    args.push(`-testexit=${launchOptions.testExit}`);
  }
  return dedupeFinalNamedArgs(positionals, args.slice(positionals.length));
}

function buildClientArgs(
  clientOptions: ResolvedClientOptions,
  hostOverride: string | undefined,
  atcCoordinatorMode: CoordinatorMode,
) {
  const runTestsMode: ATCRunTestsMode | undefined =
    shouldAutomaticallyApplyBootstrapTests(clientOptions) && shouldApplyRemoteClientBootstrap(atcCoordinatorMode)
      ? 'Client'
      : undefined;
  return buildProcessArgsWithATCRunTestsMode(
    [clientOptions.project, hostOverride ?? clientOptions.host ?? '127.0.0.1'],
    clientOptions,
    runTestsMode,
    runTestsMode === 'Client' ? clientOptions.clientIndex : undefined,
  );
}

function cloneProcessLaunchOptions<T extends ProcessLaunchOptions>(launchOptions: T): T {
  return {
    ...launchOptions,
    extraArgs: [...(launchOptions.extraArgs ?? [])],
    excludeArgs: [...(launchOptions.excludeArgs ?? [])],
    execCmds: [...(launchOptions.execCmds ?? [])],
    execTests: launchOptions.execTests ? [...launchOptions.execTests] : [],
  } as T;
}

function clonePartialProcessLaunchOptions<T extends Partial<ProcessLaunchOptions>>(launchOptions?: T): T {
  if (!launchOptions) {
    return {} as T;
  }

  return {
    ...launchOptions,
    ...(launchOptions.extraArgs ? { extraArgs: [...launchOptions.extraArgs] } : {}),
    ...(launchOptions.excludeArgs ? { excludeArgs: [...launchOptions.excludeArgs] } : {}),
    ...(launchOptions.execCmds ? { execCmds: [...launchOptions.execCmds] } : {}),
    ...(launchOptions.execTests ? { execTests: [...launchOptions.execTests] } : {}),
  } as T;
}

function mergeProcessLaunchOptions<T extends ProcessLaunchOptions>(base: T, overrides?: Partial<T>): T {
  if (!overrides) {
    return cloneProcessLaunchOptions(base);
  }

  return {
    ...cloneProcessLaunchOptions(base),
    ...overrides,
    extraArgs:
      (base.extraArgs ?? overrides.extraArgs) !== undefined
        ? [...(base.extraArgs ?? []), ...(overrides.extraArgs ?? [])]
        : [],
    excludeArgs:
      (base.excludeArgs ?? overrides.excludeArgs) !== undefined
        ? [...(base.excludeArgs ?? []), ...(overrides.excludeArgs ?? [])]
        : [],
    execCmds:
      (base.execCmds ?? overrides.execCmds) !== undefined
        ? [...(base.execCmds ?? []), ...(overrides.execCmds ?? [])]
        : [],
    execTests:
      (base.execTests ?? overrides.execTests) !== undefined
        ? [...(base.execTests ?? []), ...(overrides.execTests ?? [])]
        : [],
  } as T;
}

function mergePartialProcessLaunchOptions<T extends Partial<ProcessLaunchOptions>>(base: T, overrides?: Partial<T>): T {
  if (!overrides) {
    return clonePartialProcessLaunchOptions(base);
  }

  return {
    ...clonePartialProcessLaunchOptions(base),
    ...clonePartialProcessLaunchOptions(overrides),

    // The closest we can get to a controlled deep-merge
    extraArgs:
      (base.extraArgs ?? overrides.extraArgs) !== undefined
        ? [...(base.extraArgs ?? []), ...(overrides.extraArgs ?? [])]
        : undefined,

    excludeArgs:
      (base.excludeArgs ?? overrides.excludeArgs) !== undefined
        ? [...(base.excludeArgs ?? []), ...(overrides.excludeArgs ?? [])]
        : undefined,

    execCmds:
      (base.execCmds ?? overrides.execCmds) !== undefined
        ? [...(base.execCmds ?? []), ...(overrides.execCmds ?? [])]
        : undefined,

    execTests:
      (base.execTests ?? overrides.execTests) !== undefined
        ? [...(base.execTests ?? []), ...(overrides.execTests ?? [])]
        : undefined,
  } as T;
}

function mergeServerOptions(base: ServerOptions, overrides?: Partial<ServerOptions>): ServerOptions {
  const merged = mergeProcessLaunchOptions(base, overrides);
  return {
    ...merged,
    port: overrides?.port ?? base.port,
    timeoutSeconds: overrides?.timeoutSeconds ?? base.timeoutSeconds,
    startupMap: overrides?.startupMap ?? base.startupMap,
  };
}

function mergeClientOptions(base: ClientOptions, overrides?: Partial<ClientOptions>): ClientOptions {
  const merged = mergeProcessLaunchOptions(base, overrides);
  return {
    ...merged,
    host: overrides?.host ?? base.host,
  };
}

function mergePartialServerOptions(base: Partial<ServerOptions>, overrides?: Partial<ServerOptions>) {
  return mergePartialProcessLaunchOptions(base, overrides);
}

function mergePartialClientOptions(base: Partial<ClientOptions>, overrides?: Partial<ClientOptions>) {
  return mergePartialProcessLaunchOptions(base, overrides);
}

function shouldAutomaticallyApplyBootstrapTests(launchOptions: ProcessLaunchOptions) {
  return launchOptions.automaticallyApplyBootstrapTestsCmds !== false;
}

function shouldApplyRemoteClientBootstrap(mode: CoordinatorMode) {
  return mode === 'DedicatedServer' || mode === 'ListenServer';
}

function requiresNetworkServer(mode: CoordinatorMode) {
  return mode === 'DedicatedServer' || mode === 'ListenServer';
}

function requiresImmediateNetworkServer(serverOptions: ServerOptions, mode: CoordinatorMode) {
  if (mode === 'DedicatedServer') {
    return true;
  }

  return mode === 'ListenServer' && !!serverOptions.startupMap;
}

function resolveCoordinatorProcessLabel(mode: CoordinatorMode) {
  switch (mode) {
    case 'DedicatedServer':
      return 'DEDICATED';
    case 'ListenServer':
      return 'LISTEN';
    case 'Standalone':
      return 'STANDALONE';
    case 'PIE':
      return 'PIE';
  }

  return 'SERVER';
}

function usesDedicatedServerExecutable(mode: CoordinatorMode) {
  return mode === 'DedicatedServer';
}

function resolveMaxExternalClientCount(mode: CoordinatorMode, runtimeClientCount: number | undefined) {
  if (mode === 'Standalone' || mode === 'PIE') {
    return 0;
  }

  if (runtimeClientCount === undefined) {
    return undefined;
  }

  return Math.max(runtimeClientCount, 0);
}

function resolveClientLaunchOptions(
  clientTemplate: ResolvedClientTemplate,
  bootstrapClientIndex: number,
): ResolvedClientOptions {
  return {
    ...clientTemplate,
    clientIndex: bootstrapClientIndex,
    execTests: [...(clientTemplate.execTests ?? [])],
  };
}

function isATCBootstrapOrchestration(
  server: ResolvedServerOptions,
  clientTemplate: ResolvedClientTemplate | undefined,
  atcCoordinatorMode: CoordinatorMode,
) {
  return (
    !!clientTemplate &&
    shouldApplyRemoteClientBootstrap(atcCoordinatorMode) &&
    shouldAutomaticallyApplyBootstrapTests(server) &&
    shouldAutomaticallyApplyBootstrapTests(clientTemplate)
  );
}

function findFirstExisting(candidates: string[]) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (checkExistsSync(candidate)) return candidate;
  }
  return candidates.find(Boolean) ?? '';
}

interface CoordinatorInit {
  runtimeOptions?: E2ERuntimeOptions;
  server?: Partial<ServerOptions>;
  client?: Partial<ClientOptions>;
}

export class Coordinator {
  readonly mode: CoordinatorMode;

  private runtimeOptions: E2ERuntimeOptions;
  private serverOverrides: Partial<ServerOptions>;
  private clientOverrides: Partial<ClientOptions>;
  unrealLagOptions?: UnrealLagProxyOptions;

  constructor(mode: CoordinatorMode, init: CoordinatorInit = {}) {
    this.mode = mode;
    this.runtimeOptions = { ...init.runtimeOptions };
    this.serverOverrides = clonePartialProcessLaunchOptions(init.server);
    this.clientOverrides = clonePartialProcessLaunchOptions(init.client);
  }

  configureRuntime(opts: E2ERuntimeOptions) {
    this.runtimeOptions = {
      ...this.runtimeOptions,
      ...opts,
    };
    return this;
  }

  configureServer(opts: Partial<ServerOptions>) {
    this.serverOverrides = mergePartialServerOptions(this.serverOverrides, opts);
    return this;
  }

  configureClient(opts: Partial<ClientOptions>) {
    this.clientOverrides = mergePartialClientOptions(this.clientOverrides, opts);
    return this;
  }

  configureUnrealLag(opts: UnrealLagProxyOptions) {
    this.unrealLagOptions = opts;
    return this;
  }

  addTests(...execTests: string[]) {
    this.serverOverrides.execTests = [...(this.serverOverrides.execTests ?? []), ...execTests];
    return this;
  }

  resolveRuntimeOptions() {
    return { ...this.runtimeOptions };
  }

  buildServerOptions(projectPath: string) {
    const server = mergeServerOptions(RuntimePresets.Server(projectPath), this.serverOverrides);
    if (shouldApplyRemoteClientBootstrap(this.mode) && this.serverOverrides.testExit === undefined) {
      server.testExit = undefined;
    }
    // ListenServer should not launch the Server executable mode flag. Remove any '-server' arg so
    // buildServerArgs can add '-game' appropriately for non-dedicated launches.
    if (this.mode === CoordinatorMode.ListenServer && server.extraArgs) {
      server.extraArgs = server.extraArgs.filter((a) => a !== '-server');
    }
    return server;
  }

  buildClientOptions(projectPath: string) {
    return mergeClientOptions(RuntimePresets.Client(projectPath), this.clientOverrides);
  }
}

export class ATO {
  static readonly FrameworkValidationReporter = FrameworkValidationReporter;

  /**
   * Imports and applies options supplied from the CLI
   */
  static fromCommandLine(options: E2ECommandLineOptions = {}) {
    const cli = yargs(hideBin(options.argv ?? process.argv));

    const argv = cli
      .option('UERoot', {
        type: 'string',
        demandOption: true,
        description: 'Path to the Unreal Engine installation root (Engine directory). Example: D:/uei/UE5.7.3/Engine',
      })
      .option('Project', {
        type: 'string',
        demandOption: true,
        description:
          'Path to the .uproject to run tests against. Example: D:/ue-projects/TemplateProject/TemplateProject.uproject',
      })
      .option('clients', {
        type: 'number',
        description:
          'Optional maximum number of external client instances to allow for DedicatedServer / ListenServer runs; omit to spawn on demand',
      })
      .option('port', {
        type: 'number',
        description: 'UDP port the server should bind to; the coordinator waits for this port before launching clients',
      })
      .option('timeout', {
        type: 'number',
        description: 'Seconds to wait for the server to bind the UDP port before failing',
      })
      .option('serverExe', {
        type: 'string',
        description:
          'Optional override path to the server executable; otherwise the coordinator probes common project locations',
      })
      .option('clientExe', {
        type: 'string',
        description:
          'Optional override path to the client executable; otherwise the coordinator probes common locations',
      })
      .option('dryRun', {
        type: 'boolean',
        default: false,
        description: 'Print planned actions and exit without spawning processes (useful for CI validation)',
      })
      .option('codecov', {
        type: 'boolean',
        default: false,
        description:
          'Wrap spawned Unreal processes with OpenCppCoverage and emit per-coordinator / per-client LCOV files under coverage/atc',
      })
      .option('updateSnapshots', {
        type: 'boolean',
        default: false,
        description: 'Update file-backed ATO/ATI snapshots instead of comparing against the checked-in value',
      })
      .option('reporter', {
        choices: ['default', 'basic'] as const,
        default: 'default',
        description:
          'Terminal reporter mode. Use basic for raw process lines plus an end-of-run ATI summary, or default to use the Ink UI when the terminal supports it.',
      })
      .option('ATODebug', {
        type: 'boolean',
        default: false,
        description: 'Enable debug logging for ATO internals',
      })
      .help()
      .parseSync() as unknown as ParsedCommandLineArguments;

    const projectPath = argv.Project;
    return new ATO({
      commandLineContext: {
        ueRoot: argv.UERoot,
        projectPath,
        projectRoot: path.dirname(projectPath),
        verboseDebug: argv.ATODebug ?? false,
      },
      runtimeOptions: {
        clientCount: argv.clients ?? options.clientCount,
        port: argv.port ?? options.port,
        timeoutSeconds: argv.timeout ?? options.timeoutSeconds,
        serverExe: argv.serverExe ?? options.serverExe,
        clientExe: argv.clientExe ?? options.clientExe,
        dryRun: argv.dryRun ?? options.dryRun,
        codecov: argv.codecov ?? options.codecov,
        updateSnapshots: argv.updateSnapshots ?? options.updateSnapshots,
        reporter: argv.reporter ?? options.reporter,
      },
    });
  }

  coordinators: Coordinator[] = [];
  serverProc?: ChildProcess;
  unrealLag?: UnrealLag;
  unrealLagBindInfo?: BindInfo;

  private runtimeOptions: E2ERuntimeOptions;
  private atiOptions: ATIRuntimeOptions;
  private currentOutput?: Awaited<ReturnType<typeof createATORunOutput>>;
  private reportedBasicReporterFallback = false;
  public readonly commandLineContext?: E2ECommandLineContext;

  constructor(init: ATOInit = {}) {
    this.runtimeOptions = { ...init.runtimeOptions };
    this.atiOptions = mergeATIRuntimeOptions({ enabled: true }, init.atiOptions);
    this.commandLineContext = init.commandLineContext;
  }

  get ueRoot() {
    return this.commandLineContext?.ueRoot ?? '';
  }

  get projectPath() {
    return this.commandLineContext?.projectPath ?? '';
  }

  get shouldUpdateSnapshots() {
    return this.runtimeOptions.updateSnapshots === true;
  }

  get isDryRun() {
    return this.runtimeOptions.dryRun === true;
  }

  private get requestedReporterMode(): ATOReporterMode {
    return this.runtimeOptions.reporter ?? 'default';
  }

  get reporterMode(): ATOReporterMode {
    if (this.requestedReporterMode === 'basic') {
      return 'basic';
    }

    return this.canUseInteractiveReporter() ? 'default' : 'basic';
  }

  get output() {
    return {
      log: (...args: unknown[]) => this.log(...args),
      warn: (...args: unknown[]) => this.warn(...args),
      error: (...args: unknown[]) => this.error(...args),
    };
  }

  configureRuntime(opts: E2ERuntimeOptions) {
    this.runtimeOptions = {
      ...this.runtimeOptions,
      ...opts,
    };
    return this;
  }

  configureATI(opts: ATIRuntimeOptions) {
    this.atiOptions = mergeATIRuntimeOptions(this.atiOptions, opts);
    return this;
  }

  addCoordinator(coordinator: Coordinator) {
    this.coordinators.push(coordinator);
    return this;
  }

  async closeOutput() {
    if (!this.currentOutput) {
      return;
    }

    await this.currentOutput.close();
    this.currentOutput = undefined;
  }

  private async ensureOutput(label: string) {
    if (!this.currentOutput) {
      this.currentOutput = await createATORunOutput(path.dirname(this.projectPath), label);
      this.log(`[ATO] Saving combined console log to ${this.currentOutput.filePath}`);
    }

    return this.currentOutput;
  }

  private emitLine(line: string, options: { level?: 'log' | 'warn' | 'error'; echo?: boolean } = {}) {
    if (this.currentOutput) {
      this.currentOutput.emitLine(line, options);
      return;
    }

    if (options.echo === false) {
      return;
    }

    switch (options.level ?? 'log') {
      case 'error':
        console.error(line);
        return;
      case 'warn':
        console.warn(line);
        return;
      default:
        console.log(line);
    }
  }

  private log(...args: unknown[]) {
    if (this.currentOutput) {
      this.currentOutput.log(...args);
      return;
    }

    console.log(...args);
  }

  private warn(...args: unknown[]) {
    if (this.currentOutput) {
      this.currentOutput.warn(...args);
      return;
    }

    console.warn(...args);
  }

  private error(...args: unknown[]) {
    if (this.currentOutput) {
      this.currentOutput.error(...args);
      return;
    }

    console.error(...args);
  }

  private canUseInteractiveReporter() {
    const term = (process.env.TERM ?? '').trim().toLowerCase();
    return isInteractive() && process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY && term !== 'dumb';
  }

  private warnIfReporterModeWasDowngraded() {
    if (
      this.reportedBasicReporterFallback ||
      this.requestedReporterMode !== 'default' ||
      this.reporterMode !== 'basic'
    ) {
      return;
    }

    this.reportedBasicReporterFallback = true;
    this.warn('[ATO] Interactive ATI terminal UI is unavailable in this environment; using basic reporter mode');
  }

  preview() {
    if (this.coordinators.length === 0) {
      return [];
    }

    return this.resolveLaunchPlans().map((plan) => plan.preview);
  }

  async start(): Promise<number> {
    if (this.coordinators.length === 0) {
      this.error('No coordinators configured');
      return 2;
    }

    let plans: ResolvedLaunchPlan[];
    try {
      plans = this.resolveLaunchPlans();
    } catch (error) {
      this.error(error instanceof Error ? error.message : error);
      return 8;
    }

    let finalExitCode = 0;
    for (const plan of plans) {
      await this.ensureOutput(resolveCoordinatorProcessLabel(plan.atcCoordinatorMode));
      this.warnIfReporterModeWasDowngraded();

      if (plan.dryRun) {
        this.printDryRunPreview(plan.preview, plan.atcCoordinatorMode);
        continue;
      }

      if (!this.validateExecutables(plan)) {
        return 2;
      }

      const exitCode = await this.startResolvedPlan(plan);
      if (exitCode !== 0) {
        finalExitCode = exitCode;
      }
    }

    return finalExitCode;
  }

  private resolveLaunchPlans() {
    return this.coordinators.map((coordinator) => this.resolveLaunchPlan(coordinator));
  }

  private resolveLaunchPlan(coordinator: Coordinator): ResolvedLaunchPlan {
    const effectiveRuntimeOptions = {
      ...this.runtimeOptions,
      ...coordinator.resolveRuntimeOptions(),
    };
    const effectivePort = effectiveRuntimeOptions.port ?? 7777;
    const serverOptions = coordinator.buildServerOptions(this.projectPath);
    const effectiveTimeout = effectiveRuntimeOptions.timeoutSeconds ?? serverOptions.timeoutSeconds ?? 60;
    const atcCoordinatorMode = coordinator.mode;
    const maxExternalClients = resolveMaxExternalClientCount(atcCoordinatorMode, effectiveRuntimeOptions.clientCount);

    const server = this.resolveServerOptions(coordinator, atcCoordinatorMode, effectiveRuntimeOptions);
    const clientTemplate = this.resolveClientTemplate(coordinator, atcCoordinatorMode, effectiveRuntimeOptions);

    return {
      effectivePort,
      effectiveTimeout,
      server,
      clientTemplate,
      atcCoordinatorMode: atcCoordinatorMode,
      maxExternalClients,
      preview: this.buildPreview(
        server,
        clientTemplate,
        maxExternalClients,
        effectivePort,
        effectiveTimeout,
        atcCoordinatorMode,
        effectiveRuntimeOptions.codecov ?? false,
        coordinator.unrealLagOptions,
      ),
      dryRun: effectiveRuntimeOptions.dryRun ?? false,
      codecovEnabled: effectiveRuntimeOptions.codecov ?? false,
      unrealLagOptions: coordinator.unrealLagOptions,
    };
  }

  private resolveServerOptions(
    coordinator: Coordinator,
    atcCoordinatorMode: CoordinatorMode,
    runtimeOptions: E2ERuntimeOptions,
  ): ResolvedServerOptions {
    const serverOptions = coordinator.buildServerOptions(this.projectPath);

    // For PIE mode prefer launching the Unreal Editor (from ueRoot) when available.
    if (atcCoordinatorMode === CoordinatorMode.PIE) {
      // If the user provided an Engine root, always use the engine's UnrealEditor executable for PIE.
      if (this.ueRoot) {
        const engineEditor = path.join(this.ueRoot, 'Binaries', 'Win64', 'UnrealEditor.exe');
        return {
          ...serverOptions,
          execTests: [...(serverOptions.execTests ?? [])],
          exe: engineEditor,
        };
      }
      // Otherwise fall back to probing common candidates (including project editor locations)
      const projectRoot = path.dirname(serverOptions.project);
      const projectEditor = path.join(projectRoot, 'Binaries', 'Win64', 'UnrealEditor.exe');
      const primaryCandidates = [
        serverOptions.exe ?? '',
        runtimeOptions.serverExe ?? '',
        projectEditor,
        ...this.getPrimaryCandidates(serverOptions, atcCoordinatorMode, runtimeOptions),
      ];
      return {
        ...serverOptions,
        execTests: [...(serverOptions.execTests ?? [])],
        exe: findFirstExisting(primaryCandidates),
      };
    }

    return {
      ...serverOptions,
      execTests: [...(serverOptions.execTests ?? [])],
      exe: findFirstExisting(this.getPrimaryCandidates(serverOptions, atcCoordinatorMode, runtimeOptions)),
    };
  }

  private resolveClientTemplate(
    coordinator: Coordinator,
    atcCoordinatorMode: CoordinatorMode,
    runtimeOptions: E2ERuntimeOptions,
  ) {
    if (!shouldApplyRemoteClientBootstrap(atcCoordinatorMode)) {
      return undefined;
    }

    const clientOptions = coordinator.buildClientOptions(this.projectPath);
    return {
      ...clientOptions,
      exe: findFirstExisting(this.getClientCandidates(clientOptions, runtimeOptions)),
      host: clientOptions.host ?? '127.0.0.1',
    } satisfies ResolvedClientTemplate;
  }

  /**
   * Determines the primary candidates for server executable based on coordinator mode and runtime options.
   */
  private getPrimaryCandidates(
    serverOptions: ServerOptions,
    atcCoordinatorMode: CoordinatorMode,
    runtimeOptions: E2ERuntimeOptions,
  ) {
    if (usesDedicatedServerExecutable(atcCoordinatorMode)) {
      return this.getDedicatedServerCandidates(serverOptions, runtimeOptions);
    }

    // For Standalone and ListenServer modes we want the game's regular executable (e.g. TemplateProject.exe),
    // not the server executable which usually ends with "Server.exe".
    if (atcCoordinatorMode === CoordinatorMode.Standalone || atcCoordinatorMode === CoordinatorMode.ListenServer) {
      return this.getStandaloneCandidates(serverOptions, runtimeOptions);
    }

    if (atcCoordinatorMode === CoordinatorMode.PIE) {
      return this.getPieCandidates(serverOptions, runtimeOptions);
    }

    return this.getHostCandidates(serverOptions, runtimeOptions);
  }

  private getDedicatedServerCandidates(serverOptions: ServerOptions, runtimeOptions: E2ERuntimeOptions) {
    const projectRoot = path.dirname(serverOptions.project);
    return [
      runtimeOptions.serverExe ?? '',
      serverOptions.exe ?? '',
      path.join(projectRoot, 'Binaries', 'Win64', `${path.basename(projectRoot)}Server.exe`),
    ];
  }

  /**
   * Determines the executable for Servers only.
   *
   * Not for Clients.
   */
  private getHostCandidates(serverOptions: ServerOptions, runtimeOptions: E2ERuntimeOptions) {
    const projectRoot = path.dirname(serverOptions.project);
    return [
      serverOptions.exe ?? '',
      runtimeOptions.serverExe ?? '',
      path.join(projectRoot, 'Binaries', 'Win64', `${path.basename(projectRoot)}Server.exe`),
    ];
  }

  /**
   * Candidates for Standalone mode (use the regular game executable rather than the Server exe).
   */
  private getStandaloneCandidates(serverOptions: ServerOptions, runtimeOptions: E2ERuntimeOptions) {
    const projectRoot = path.dirname(serverOptions.project);
    return [
      // allow explicit overrides first
      serverOptions.exe ?? '',
      // a global client exe override is likely the desired game executable for Standalone
      runtimeOptions.clientExe ?? '',
      // fallback to the game's executable (no "Server" suffix)
      path.join(projectRoot, 'Binaries', 'Win64', `${path.basename(projectRoot)}.exe`),
      // fallback to any serverExe override
      runtimeOptions.serverExe ?? '',
    ];
  }

  /**
   * Candidates for PIE mode — prefer launching the Unreal Editor executable
   */
  private getPieCandidates(serverOptions: ServerOptions, runtimeOptions: E2ERuntimeOptions) {
    const projectRoot = path.dirname(serverOptions.project);
    return [
      // explicit override first
      serverOptions.exe ?? '',
      // runtime overrides
      runtimeOptions.serverExe ?? '',
      runtimeOptions.clientExe ?? '',
      // typical editor binary in project Binaries
      path.join(projectRoot, 'Binaries', 'Win64', 'UnrealEditor.exe'),
      // fallback to project game exe (least preferred)
      path.join(projectRoot, 'Binaries', 'Win64', `${path.basename(projectRoot)}.exe`),
    ];
  }

  private getClientCandidates(clientOptions: ClientOptions, runtimeOptions: E2ERuntimeOptions) {
    const projectRoot = path.dirname(clientOptions.project);

    return [
      runtimeOptions.clientExe ?? '',
      clientOptions.exe ?? '',
      path.join(projectRoot, 'Binaries', 'Win64', `${path.basename(projectRoot)}.exe`),
    ];
  }

  private buildPreview(
    serverOptions: ResolvedServerOptions,
    clientTemplate: ResolvedClientTemplate | undefined,
    maxExternalClients: number | undefined,
    port: number,
    timeoutSeconds: number,
    atcCoordinatorMode: CoordinatorMode,
    codecovEnabled: boolean,
    unrealLagOptions: UnrealLagProxyOptions | undefined,
  ): ResolvedPreview {
    const serverArgs = buildServerArgs(
      serverOptions,
      requiresNetworkServer(atcCoordinatorMode) ? port : undefined,
      atcCoordinatorMode,
    );
    const unrealLagPreview = this.buildUnrealLagPreview(port, timeoutSeconds, atcCoordinatorMode, unrealLagOptions);
    const proxyHost = unrealLagPreview
      ? this.formatProxyHost(unrealLagPreview.bindAddress, unrealLagPreview.bindPort)
      : undefined;

    const serverPreview = this.resolvePreparedProcessLaunch(
      atcCoordinatorMode,
      resolveCoordinatorProcessLabel(atcCoordinatorMode),
      serverOptions.exe,
      serverArgs,
      codecovEnabled,
    );

    const clientTemplatePreview = clientTemplate
      ? (() => {
          const client = resolveClientLaunchOptions(clientTemplate, 0);
          const args = buildClientArgs(client, proxyHost, atcCoordinatorMode);
          return this.resolvePreparedProcessLaunch(
            atcCoordinatorMode,
            `CLIENT ${client.clientIndex}`,
            client.exe,
            args,
            codecovEnabled,
          );
        })()
      : undefined;

    const clientPreviews =
      clientTemplate && maxExternalClients !== undefined
        ? Array.from({ length: maxExternalClients }, (_, clientIndex) => {
            const client = resolveClientLaunchOptions(clientTemplate, clientIndex);
            const args = buildClientArgs(client, proxyHost, atcCoordinatorMode);
            return this.resolvePreparedProcessLaunch(
              atcCoordinatorMode,
              `CLIENT ${client.clientIndex}`,
              client.exe,
              args,
              codecovEnabled,
            );
          })
        : [];

    return {
      server: serverPreview,
      clients: clientPreviews,
      clientTemplate: clientTemplatePreview,
      maxExternalClients: clientTemplate ? (maxExternalClients ?? 'unbounded') : undefined,
      unrealLag: unrealLagPreview,
    };
  }

  private buildUnrealLagPreview(
    port: number,
    timeoutSeconds: number,
    atcCoordinatorMode: CoordinatorMode | undefined,
    unrealLagOptions: UnrealLagProxyOptions | undefined,
  ) {
    if (!unrealLagOptions || (atcCoordinatorMode && !requiresNetworkServer(atcCoordinatorMode))) return undefined;

    return {
      bindAddress: unrealLagOptions.bindAddress ?? '127.0.0.1',
      bindPort: unrealLagOptions.bindPort ?? 0,
      serverProfile: unrealLagOptions.serverProfile ?? 'Good',
      clientProfile: unrealLagOptions.clientProfile ?? 'Good',
      targetServerPort: port,
      timeoutSeconds,
    };
  }

  private formatProxyHost(bindAddress: string, bindPort: number) {
    const displayPort = bindPort === 0 ? '<runtime-port>' : bindPort;
    return `${bindAddress}:${displayPort}`;
  }

  private printDryRunPreview(preview: ResolvedPreview, atcCoordinatorMode: CoordinatorMode) {
    const coordinatorLabel = resolveCoordinatorProcessLabel(atcCoordinatorMode);
    if (preview.unrealLag) {
      this.log('[DRYRUN] UnrealLag ->', JSON.stringify(preview.unrealLag));
    }
    this.log(`[DRYRUN] ${coordinatorLabel} -> ${preview.server.command}`);
    this.log(`[DRYRUN-ARGS] ${coordinatorLabel} ARGS:`, JSON.stringify(preview.server.args));
    if (preview.clientTemplate) {
      this.log(
        `[DRYRUN] Client Template -> ${preview.clientTemplate.command} (max=${String(preview.maxExternalClients ?? 0)})`,
      );
      this.log('[DRYRUN-ARGS] Client Template ARGS:', JSON.stringify(preview.clientTemplate.args));
    }
    preview.clients.forEach((client, index) => {
      this.log(`[DRYRUN] Client ${index + 1} -> ${client.command}`);
      this.log(`[DRYRUN-ARGS] Client ${index + 1} ARGS:`, JSON.stringify(client.args));
    });
  }

  private resolveATIServiceOptions(plan: ResolvedLaunchPlan) {
    if (this.atiOptions.enabled === false) {
      return [];
    }

    const configuredServices =
      this.atiOptions.services && this.atiOptions.services.length > 0 ? this.atiOptions.services : [{}];
    const projectRoot = path.dirname(this.projectPath);
    const defaultLabel = resolveATIRunLabel(plan.atcCoordinatorMode);

    return configuredServices.map((service, index) => {
      const label =
        service.label?.trim() || (configuredServices.length === 1 ? defaultLabel : `${defaultLabel}-${index + 1}`);
      const ndjson =
        service.ndjson === false
          ? false
          : {
              directory: resolveATINDJSONDirectory(projectRoot, label, service.ndjson?.directory),
              fileName: service.ndjson?.fileName ?? '',
              maxFileSizeBytes: service.ndjson?.maxFileSizeBytes ?? 0,
            };

      return {
        label,
        host: service.host ?? '127.0.0.1',
        port: service.port ?? 0,
        connectTimeoutSeconds: service.connectTimeoutSeconds ?? 0.25,
        validateSchema: service.validateSchema ?? true,
        maxEventSizeBytes: service.maxEventSizeBytes ?? 1024 * 1024,
        ndjson,
        terminal: service.terminal ?? true,
      } satisfies ResolvedATIServiceOptions;
    });
  }

  private async startATIForPlan(
    plan: ResolvedLaunchPlan,
    spawnControlState?: ATCObservationState,
  ): Promise<StartedATIService[]> {
    const startedServices: StartedATIService[] = [];

    if (spawnControlState) {
      try {
        const service = new ATIService({
          host: '127.0.0.1',
          port: 0,
          validateSchema: true,
          maxEventSizeBytes: 1024 * 1024,
        });
        service.addConsumer(new ATOSpawnControlConsumer(spawnControlState));
        await service.start();
        const endpoint = service.getEndpoint();
        this.log(`[ATI] ATO spawn control listening on ${endpoint.host}:${endpoint.port}`);
        startedServices.push({
          label: 'ATO Spawn Control',
          service,
          endpoint: {
            host: endpoint.host,
            port: endpoint.port,
            connectTimeoutSeconds: 0.25,
          },
        });
      } catch (error) {
        this.warn(
          `[ATI] Failed to start internal spawn-control service: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const serviceOptions of this.resolveATIServiceOptions(plan)) {
      if (serviceOptions.ndjson === false && !serviceOptions.terminal) {
        this.warn(`[ATI] ${serviceOptions.label} has no consumers configured; skipping managed ATI service`);
        continue;
      }

      try {
        if (serviceOptions.ndjson !== false) {
          await mkdir(serviceOptions.ndjson.directory, { recursive: true });
        }

        const service = new ATIService({
          host: serviceOptions.host,
          port: serviceOptions.port,
          validateSchema: serviceOptions.validateSchema,
          maxEventSizeBytes: serviceOptions.maxEventSizeBytes,
        });

        if (serviceOptions.ndjson !== false) {
          service.addConsumer(
            new NDJSONConsumer({
              directory: serviceOptions.ndjson.directory,
              ...(serviceOptions.ndjson.fileName ? { fileName: serviceOptions.ndjson.fileName } : {}),
              ...(serviceOptions.ndjson.maxFileSizeBytes > 0
                ? { maxFileSizeBytes: serviceOptions.ndjson.maxFileSizeBytes }
                : {}),
            }),
          );
        }

        if (serviceOptions.terminal) {
          service.addConsumer(
            new TerminalConsumer({
              mode: this.reporterMode,
              isTTY: this.canUseInteractiveReporter(),
              writeLog: (line) => this.log(line),
              writeWarn: (line) => this.warn(line),
              writeError: (line) => this.error(line),
            }),
          );
        }

        await service.start();
        const endpoint = service.getEndpoint();
        this.log(`[ATI] ${serviceOptions.label} listening on ${endpoint.host}:${endpoint.port}`);
        startedServices.push({
          label: serviceOptions.label,
          service,
          endpoint: {
            host: endpoint.host,
            port: endpoint.port,
            connectTimeoutSeconds: serviceOptions.connectTimeoutSeconds,
          },
        });
      } catch (error) {
        this.warn(
          `[ATI] Failed to start managed ATI service '${serviceOptions.label}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return startedServices;
  }

  private async stopATIForPlan(startedServices: StartedATIService[]) {
    for (const startedService of [...startedServices].reverse()) {
      try {
        await startedService.service.stop();
      } catch (error) {
        this.warn(
          `[ATI] Failed to stop managed ATI service '${startedService.label}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private validateExecutables(plan: ResolvedLaunchPlan) {
    if (!checkExistsSync(plan.server.exe)) {
      this.error(`Server executable not found: ${plan.server.exe}`);
      return false;
    }

    if (plan.clientTemplate && !checkExistsSync(plan.clientTemplate.exe)) {
      this.error(`Client executable not found: ${plan.clientTemplate.exe}`);
      return false;
    }

    if (plan.codecovEnabled) {
      const coverageExecutable = resolveCodeCoverageExecutable(path.dirname(this.projectPath));
      if (!isCodeCoverageExecutableAvailable(coverageExecutable)) {
        this.error(
          `OpenCppCoverage executable not found: ${coverageExecutable}. Install OpenCppCoverage, place OpenCppCoverage.exe in the project root, or set OPENCPPCOVERAGE_PATH.`,
        );
        return false;
      }
    }

    return true;
  }

  private resolvePreparedProcessLaunch(
    coordinatorMode: CoordinatorMode,
    processLabel: string,
    exe: string,
    args: string[],
    codecovEnabled: boolean,
  ): PreparedProcessLaunch {
    if (!codecovEnabled) {
      return {
        exe,
        args,
        command: formatCommand(exe, args),
      };
    }

    const wrapped = buildCoverageWrappedLaunch({
      projectRoot: path.dirname(this.projectPath),
      ueRoot: this.ueRoot,
      coordinatorMode,
      processLabel,
      executable: exe,
      args,
    });

    return {
      exe: wrapped.exe,
      args: wrapped.args,
      command: formatCommand(wrapped.exe, wrapped.args),
      reportFilePath: wrapped.reportFilePath,
      waitForDescendantProcessPortBinding: wrapped.waitForDescendantProcessPortBinding,
    };
  }

  private createMonitoredProcess(
    exe: string,
    args: string[],
    label: string,
    timeoutSeconds: number,
    expectAutomation: boolean,
    waitForDescendantProcessPortBinding = false,
    atcState?: ATCObservationState,
  ) {
    const automation = createAutomationObservationState(expectAutomation);
    const atc = atcState ?? { requestedRemoteClients: 0 };
    const observeLine = (line: string) => {
      observeAutomationLogLine(automation, line);
      ATO.FrameworkValidationReporter.observeProcessLine(label, line);
      const metadata = parseATCClientRequestMetadataLine(line);
      if (metadata) {
        applyATCRequestedRemoteClients(atc, metadata.requiredClients);
      }
    };
    const process = spawnProcess(exe, args, label, {
      onStdoutLine: observeLine,
      onStderrLine: observeLine,
      emitLine: (line, streamKind) => {
        const level = streamKind === 'stderr' ? 'error' : 'log';
        this.emitLine(line, { level, echo: this.reporterMode === 'basic' });
      },
    });
    const exitPromise = promiseProcessExitOrTimeout(
      process,
      timeoutSeconds,
      () => {
        this.error(`${label} exceeded maxLifetime (${timeoutSeconds}s); killing process`);
        killProcessTree(process);
      },
      (error) => this.error('Process error', error),
    );

    return {
      label,
      process,
      automation,
      atc,
      exitPromise,
      waitForDescendantProcessPortBinding,
    } satisfies MonitoredProcess;
  }

  private async startResolvedPlan(plan: ResolvedLaunchPlan): Promise<number> {
    const outcomes: ProcessOutcome[] = [];
    let serverMonitor: MonitoredProcess | undefined;
    const clientMonitors: MonitoredProcess[] = [];
    let startedATI: StartedATIService[] = [];
    const coordinatorLabel = resolveCoordinatorProcessLabel(plan.atcCoordinatorMode);

    try {
      const bootstrapOrchestration = isATCBootstrapOrchestration(
        plan.server,
        plan.clientTemplate,
        plan.atcCoordinatorMode,
      );
      const serverMaxLifetime = plan.server.maxLifetime ?? 600;
      const serverATCState: ATCObservationState = { requestedRemoteClients: 0 };
      const proxyClientHost = requiresNetworkServer(plan.atcCoordinatorMode)
        ? await this.startUnrealLag(plan.effectivePort, plan.unrealLagOptions)
        : undefined;
      startedATI = await this.startATIForPlan(plan, bootstrapOrchestration ? serverATCState : undefined);

      const serverArgs = appendResolvedExtraArgs(
        buildServerArgs(
          plan.server,
          requiresNetworkServer(plan.atcCoordinatorMode) ? plan.effectivePort : undefined,
          plan.atcCoordinatorMode,
        ),
        buildATIReporterArgs(startedATI.map((startedService) => startedService.endpoint)),
      );
      const serverLaunch = this.resolvePreparedProcessLaunch(
        plan.atcCoordinatorMode,
        coordinatorLabel,
        plan.server.exe,
        serverArgs,
        plan.codecovEnabled,
      );
      if (serverLaunch.reportFilePath) {
        this.log(`[CODECOV] ${coordinatorLabel} -> ${serverLaunch.reportFilePath}`);
      }
      this.log(`[SPAWN] ${coordinatorLabel} -> ${serverLaunch.command}`);
      this.log(`[SPAWN-ARGS] ${coordinatorLabel} ARGS:`, JSON.stringify(serverLaunch.args), '\n');
      serverMonitor = this.createMonitoredProcess(
        serverLaunch.exe,
        serverLaunch.args,
        coordinatorLabel,
        serverMaxLifetime,
        hasAutomationCommands(plan.server),
        serverLaunch.waitForDescendantProcessPortBinding,
        serverATCState,
      );
      this.serverProc = serverMonitor.process;

      const serverPid = this.serverProc.pid ?? -1;
      if (serverPid <= 0) {
        this.error('Failed to obtain server PID');
        outcomes.push({
          label: coordinatorLabel,
          rawExitResult: -1,
          effectiveExitCode: FAILURE_EXIT_CODE,
          reason: 'failed to obtain server pid',
          automation: serverMonitor.automation,
        });
        return FAILURE_EXIT_CODE;
      }

      if (requiresImmediateNetworkServer(plan.server, plan.atcCoordinatorMode)) {
        const serverStatus = await this.waitForServerReady(
          serverPid,
          plan.effectivePort,
          plan.effectiveTimeout,
          serverMonitor.exitPromise,
          serverMonitor.waitForDescendantProcessPortBinding,
        );
        if (serverStatus !== 'bound') {
          killProcessTree(this.serverProc);
          const finalServerExit = await serverMonitor.exitPromise;
          outcomes.push(
            summarizeStartupFailureOutcome(coordinatorLabel, finalServerExit, serverMonitor.automation, serverStatus),
          );
          return this.handleServerStartupFailure(serverStatus);
        }
      }

      if (bootstrapOrchestration) {
        if (
          plan.atcCoordinatorMode === CoordinatorMode.DedicatedServer &&
          plan.clientTemplate &&
          plan.maxExternalClients !== undefined &&
          clientMonitors.length < plan.maxExternalClients
        ) {
          this.spawnClients(
            plan.clientTemplate,
            clientMonitors.length,
            plan.maxExternalClients,
            plan.atcCoordinatorMode,
            plan.codecovEnabled,
            proxyClientHost,
            clientMonitors,
          );
        }

        const bootstrapRequestResult = await this.monitorATCClientRequestsUntilAutomationTerminal(
          plan.clientTemplate,
          plan.maxExternalClients,
          plan.atcCoordinatorMode,
          plan.codecovEnabled,
          proxyClientHost,
          clientMonitors,
          serverMonitor,
          serverMaxLifetime,
        );

        await this.waitForClientAutomationTerminalState(clientMonitors, 15);

        try {
          killProcessTree(this.serverProc);
        } catch {}

        for (const monitor of clientMonitors) {
          killProcessTree(monitor.process);
        }

        const finalServerExit = await serverMonitor.exitPromise;
        outcomes.unshift(summarizeProcessOutcome(coordinatorLabel, finalServerExit, serverMonitor.automation));

        const clientOutcomes = await this.waitForClientMonitors(clientMonitors);
        outcomes.push(...clientOutcomes);

        if (!bootstrapRequestResult) {
          return FAILURE_EXIT_CODE;
        }

        return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
      }

      if (!plan.clientTemplate) {
        const finalServerExit = await serverMonitor.exitPromise;
        outcomes.unshift(summarizeProcessOutcome(coordinatorLabel, finalServerExit, serverMonitor.automation));
        return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
      }

      const eagerClientCount = plan.maxExternalClients ?? 0;
      if (clientMonitors.length < eagerClientCount) {
        this.spawnClients(
          plan.clientTemplate,
          clientMonitors.length,
          eagerClientCount,
          plan.atcCoordinatorMode,
          plan.codecovEnabled,
          proxyClientHost,
          clientMonitors,
        );
      }

      const clientOutcomes = await this.waitForClientMonitors(clientMonitors, serverMonitor);
      outcomes.push(...clientOutcomes);

      try {
        killProcessTree(this.serverProc);
      } catch {}

      const finalServerExit = await serverMonitor.exitPromise;
      outcomes.unshift(summarizeProcessOutcome(coordinatorLabel, finalServerExit, serverMonitor.automation));
      return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
    } finally {
      try {
        killProcessTree(this.serverProc);
      } catch {}
      await this.stopATIForPlan(startedATI);
      await this.stopUnrealLag();
      printOrchestrationSummary(outcomes, (line) => this.log(line));
      for (const line of formatFrameworkValidationSummaryLines(ATO.FrameworkValidationReporter.getReport())) {
        this.log(line);
      }
    }
  }

  private async startUnrealLag(effectivePort: number, unrealLagOptions: UnrealLagProxyOptions | undefined) {
    if (!unrealLagOptions) {
      return undefined;
    }

    const serverProfileName = unrealLagOptions.serverProfile ?? 'NoLag';
    const clientProfileName = unrealLagOptions.clientProfile ?? 'NoLag';

    this.unrealLag = new UnrealLag({
      bindAddress: unrealLagOptions.bindAddress ?? '127.0.0.1',
      bindPort: unrealLagOptions.bindPort ?? 0,
      server: {
        address: '127.0.0.1',
        port: effectivePort,
        selection: { profile: serverProfileName },
      },
      defaultClient: { profile: clientProfileName },
      autoCreateClients: true,
      verboseDebug: this.commandLineContext?.verboseDebug ?? false,
    });
    this.unrealLagBindInfo = await this.unrealLag.start();

    // Warn if chosen profiles may cause ATC coordination issues
    const allProfiles = { ...UnrealLagProfiles, ...unrealLagOptions } as Record<string, unknown>;
    for (const name of [serverProfileName, clientProfileName]) {
      const profile =
        (allProfiles as Record<string, unknown>)[name] ?? (UnrealLagProfiles as Record<string, unknown>)[name];
      if (profile && typeof profile === 'object' && 'inbound' in profile && 'outbound' in profile) {
        logWarningIfNetworkProfileUnstable(profile as Parameters<typeof logWarningIfNetworkProfileUnstable>[0]);
      }
    }

    const proxyClientHost = `${this.unrealLagBindInfo.address}:${this.unrealLagBindInfo.port}`;
    this.log(
      `[SPAWN] UNREALLAG -> proxy listening on ${proxyClientHost} (server profile=${serverProfileName}, client profile=${clientProfileName})`,
    );
    return proxyClientHost;
  }

  private async stopUnrealLag() {
    await this.unrealLag?.stop();
  }

  private async waitForServerReady(
    serverPid: number,
    port: number,
    timeoutSeconds: number,
    serverExitPromise: Promise<ProcessExitResult>,
    waitForDescendantProcessPortBinding = false,
  ) {
    const serverBindPromise = (async () => {
      try {
        await waitForUdpPortFromProcessTree(serverPid, port, timeoutSeconds, waitForDescendantProcessPortBinding);
        this.log('Server bound UDP port', port);
        return 'bound' as const;
      } catch (error) {
        this.error('Server failed to bind UDP port', error);
        return 'bind-failed' as const;
      }
    })();

    return Promise.race([serverBindPromise, serverExitPromise]);
  }

  private async handleServerStartupFailure(status: number | 'timeout' | 'bind-failed') {
    if (status === 'bind-failed' || status === 'timeout') {
      this.error('Server failed to come up in time or exceeded lifetime');
    } else {
      this.error('Server exited before binding the expected UDP port', status);
    }
    try {
      killProcessTree(this.serverProc);
    } catch {}
    await this.stopUnrealLag();
    return FAILURE_EXIT_CODE;
  }

  private spawnClients(
    clientTemplate: ResolvedClientTemplate,
    fromIndex: number,
    toExclusiveIndex: number,
    atcCoordinatorMode: CoordinatorMode,
    codecovEnabled: boolean,
    proxyClientHost: string | undefined,
    clientMonitors: MonitoredProcess[],
  ) {
    for (let clientIndex = fromIndex; clientIndex < toExclusiveIndex; clientIndex += 1) {
      const client = resolveClientLaunchOptions(clientTemplate, clientIndex);
      const args = buildClientArgs(client, proxyClientHost, atcCoordinatorMode);
      const prefix = `CLIENT ${client.clientIndex}`;
      const clientLaunch = this.resolvePreparedProcessLaunch(
        atcCoordinatorMode,
        prefix,
        client.exe,
        args,
        codecovEnabled,
      );
      if (clientLaunch.reportFilePath) {
        this.log(`[CODECOV] ${prefix} -> ${clientLaunch.reportFilePath}`);
      }
      this.log(`[SPAWN] ${prefix} -> ${clientLaunch.command}`);
      this.log(`[SPAWN-ARGS] ${prefix} ARGS:`, JSON.stringify(clientLaunch.args), '\n');
      clientMonitors.push(
        this.createMonitoredProcess(
          clientLaunch.exe,
          clientLaunch.args,
          prefix,
          client.maxLifetime ?? 300,
          (client.execTests?.length ?? 0) > 0,
          clientLaunch.waitForDescendantProcessPortBinding,
        ),
      );
    }
  }

  private async monitorATCClientRequestsUntilAutomationTerminal(
    clientTemplate: ResolvedClientTemplate | undefined,
    maxExternalClients: number | undefined,
    atcCoordinatorMode: CoordinatorMode,
    codecovEnabled: boolean,
    proxyClientHost: string | undefined,
    clientMonitors: MonitoredProcess[],
    serverMonitor: MonitoredProcess,
    timeoutSeconds: number,
  ) {
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      const requestedRemoteClients = serverMonitor.atc.requestedRemoteClients;
      if (requestedRemoteClients > 0 && !clientTemplate) {
        this.error(
          `[ATO] ATC requested ${requestedRemoteClients} remote client(s), but this coordinator mode does not provide external clients`,
        );
        try {
          killProcessTree(serverMonitor.process);
        } catch {}
        await serverMonitor.exitPromise;
        return false;
      }

      if (maxExternalClients !== undefined && requestedRemoteClients > maxExternalClients) {
        this.error(
          `[ATO] ATC requested ${requestedRemoteClients} remote client(s), but the configured maximum is ${maxExternalClients}`,
        );
        try {
          killProcessTree(serverMonitor.process);
        } catch {}
        await serverMonitor.exitPromise;
        return false;
      }

      if (clientTemplate && clientMonitors.length < requestedRemoteClients) {
        this.spawnClients(
          clientTemplate,
          clientMonitors.length,
          requestedRemoteClients,
          atcCoordinatorMode,
          codecovEnabled,
          proxyClientHost,
          clientMonitors,
        );
      }

      if (hasTerminalAutomationResult(serverMonitor.automation)) {
        return true;
      }

      const serverFinished = await Promise.race([
        serverMonitor.exitPromise.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 250)),
      ]);
      if (serverFinished) {
        return true;
      }
    }

    this.error(`[ATO] Timed out waiting for ${serverMonitor.label} automation to reach a terminal state`);
    try {
      killProcessTree(serverMonitor.process);
    } catch {}
    await serverMonitor.exitPromise;
    return false;
  }

  private async waitForClientAutomationTerminalState(clientMonitors: MonitoredProcess[], timeoutSeconds: number) {
    if (clientMonitors.length === 0) {
      return;
    }

    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      if (clientMonitors.every((monitor) => hasTerminalAutomationResult(monitor.automation))) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  private async waitForClientMonitors(clientMonitors: MonitoredProcess[], serverMonitor?: MonitoredProcess) {
    if (clientMonitors.length === 0) {
      return [];
    }

    const allClientExitResults = Promise.all(clientMonitors.map((monitor) => monitor.exitPromise));
    if (serverMonitor) {
      const completion = await Promise.race([
        allClientExitResults.then((results) => ({ kind: 'clients' as const, results })),
        serverMonitor.exitPromise.then((serverExit) => ({ kind: 'server' as const, serverExit })),
      ]);

      if (completion.kind === 'server') {
        const pendingClients = clientMonitors.filter((monitor) => !monitor.process.killed);
        if (pendingClients.length > 0) {
          this.error(
            `${serverMonitor.label} exited before all clients completed (${completion.serverExit}); terminating remaining clients`,
          );
        }
        for (const monitor of pendingClients) {
          killProcessTree(monitor.process);
        }
      }
    }

    const rawClientResults = await allClientExitResults;
    return rawClientResults.map((rawExitResult, index) =>
      summarizeProcessOutcome(clientMonitors[index].label, rawExitResult, clientMonitors[index].automation),
    );
  }
}
