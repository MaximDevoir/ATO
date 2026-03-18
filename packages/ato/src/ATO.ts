// TODO: Support Linux/macOS. Right now Win64 and .exe is hardcoded a lot.
import type { ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { logWarningIfNetworkProfileUnstable, UnrealLagProfiles } from '@maximdevoir/unreal-lag/profiles';
import type { BindInfo } from '@maximdevoir/unreal-lag/types';
import { UnrealLag } from '@maximdevoir/unreal-lag/UnrealLag';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ATC_CLIENT_REQUEST_LOG_PREFIX, ATC_RUN_TESTS_COMMAND } from './ATCAutomationNames';
import { checkExistsSync } from './ATO._helpers';
import { spawnProcess, waitForUdpPort } from './ATO.helpers';
import type {
  ClientOptions,
  E2ECommandLineContext,
  E2ECommandLineOptions,
  E2ERuntimeOptions,
  ProcessLaunchOptions,
  ServerOptions,
  UnrealLagProxyOptions,
} from './ATO.options';
import { OrchestratorMode, RuntimePresets } from './ATO.options';

export * from './ATCAutomationNames';
export { ATC_RUN_TESTS_COMMAND } from './ATCAutomationNames';
export { OrchestratorMode, RuntimePresets } from './ATO.options';

interface ATOInit {
  runtimeOptions?: E2ERuntimeOptions;
  commandLineContext?: E2ECommandLineContext;
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
  atcOrchestratorMode: OrchestratorMode;
  maxExternalClients?: number;
  preview: ResolvedPreview;
  dryRun: boolean;
  unrealLagOptions?: UnrealLagProxyOptions;
}

interface ParsedCommandLineArguments {
  UERoot: string;
  Project: string;
  clients?: number;
  port?: number;
  timeout?: number;
  serverExe?: string;
  clientExe?: string;
  dryRun: boolean;
}

export interface ATCClientRequestMetadata {
  fixturePath: string;
  requiredClients: number;
}

interface ATCObservationState {
  requestedRemoteClients: number;
}

const FAILURE_EXIT_CODE = 1;

type ProcessExitResult = number | 'timeout';
type ATCRunTestsMode = OrchestratorMode | 'Client';

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
}

interface ProcessOutcome {
  label: string;
  rawExitResult: ProcessExitResult;
  effectiveExitCode: number;
  reason: string;
  automation: AutomationObservationState;
}

function promiseProcessExitOrTimeout(processHandle: ChildProcess, timeoutSeconds: number, onTimeout: () => void) {
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
      console.error('Process error', error);
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
    const fixturePath = typeof parsed.fixturePath === 'string' ? parsed.fixturePath.trim() : '';
    const requiredClients =
      typeof parsed.requiredClients === 'number' &&
      Number.isInteger(parsed.requiredClients) &&
      parsed.requiredClients >= 0
        ? parsed.requiredClients
        : undefined;
    if (!fixturePath || requiredClients === undefined) {
      return undefined;
    }

    return {
      fixturePath,
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

function printOrchestrationSummary(outcomes: ProcessOutcome[]) {
  if (outcomes.length === 0) {
    return;
  }
  console.log('Orchestration Complete');

  const automationOutcomes = outcomes.filter((outcome) => outcome.automation.expectAutomation);
  if (automationOutcomes.length > 0) {
    console.log('Test Summary');
    for (const outcome of automationOutcomes) {
      const summaryLine = formatAutomationSummaryLine(outcome.label, outcome.automation);
      if (summaryLine) {
        console.log(summaryLine);
      }
      for (const test of outcome.automation.unsuccessfulTests) {
        console.log(formatUnsuccessfulAutomationTestLine(outcome.label, test));
      }
    }
    console.log('');
  }

  console.log('Exit Codes');
  for (const outcome of outcomes) {
    console.log(formatProcessExitLine(outcome));
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
    if (entry.optionName) {
      lastIndexByOption.set(entry.optionName, index);
    }
  });

  return entries.filter((entry, index) => !entry.optionName || lastIndexByOption.get(entry.optionName) === index);
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

function resolveListenStartupUrl(startupMap: string | undefined) {
  if (!startupMap) {
    return undefined;
  }

  return startupMap.includes('?') ? `${startupMap}?listen` : `${startupMap}?listen`;
}

function buildServerArgs(
  serverOptions: ServerOptions,
  port?: number,
  atcOrchestratorMode: OrchestratorMode = OrchestratorMode.DedicatedServer,
) {
  const positionals = [serverOptions.project];
  if (atcOrchestratorMode === 'ListenServer') {
    const listenStartupUrl = resolveListenStartupUrl(serverOptions.startupMap);
    if (listenStartupUrl) {
      positionals.push(listenStartupUrl);
    }
  }

  // Clone configured extra args. For non-dedicated modes we need to ensure '-server' is removed
  // so that ListenServer / Standalone don't accidentally have both '-game' and '-server'.
  let extraArgs = [...(serverOptions.extraArgs ?? [])];
  if (atcOrchestratorMode !== 'DedicatedServer') {
    extraArgs = extraArgs.filter((a) => a !== '-server');
    if (atcOrchestratorMode !== 'PIE' && !extraArgs.includes('-game')) {
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
    shouldAutomaticallyApplyBootstrapTests(serverOptions) ? atcOrchestratorMode : undefined,
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
  atcOrchestratorMode: OrchestratorMode,
) {
  const runTestsMode: ATCRunTestsMode | undefined =
    shouldAutomaticallyApplyBootstrapTests(clientOptions) && shouldApplyRemoteClientBootstrap(atcOrchestratorMode)
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
    extraArgs: overrides.extraArgs !== undefined ? [...overrides.extraArgs] : [...(base.extraArgs ?? [])],
    excludeArgs: overrides.excludeArgs !== undefined ? [...overrides.excludeArgs] : [...(base.excludeArgs ?? [])],
    execCmds: overrides.execCmds !== undefined ? [...overrides.execCmds] : [...(base.execCmds ?? [])],
    execTests: overrides.execTests !== undefined ? [...overrides.execTests] : [...(base.execTests ?? [])],
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

function shouldApplyRemoteClientBootstrap(mode: OrchestratorMode) {
  return mode === 'DedicatedServer' || mode === 'ListenServer';
}

function requiresNetworkServer(mode: OrchestratorMode) {
  return mode === 'DedicatedServer' || mode === 'ListenServer';
}

function requiresImmediateNetworkServer(serverOptions: ServerOptions, mode: OrchestratorMode) {
  if (mode === 'DedicatedServer') {
    return true;
  }

  return mode === 'ListenServer' && !!serverOptions.startupMap;
}

function resolveOrchestratorProcessLabel(mode: OrchestratorMode) {
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

function usesDedicatedServerExecutable(mode: OrchestratorMode) {
  return mode === 'DedicatedServer';
}

function resolveMaxExternalClientCount(mode: OrchestratorMode, runtimeClientCount: number | undefined) {
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
  atcOrchestratorMode: OrchestratorMode,
) {
  return (
    !!clientTemplate &&
    shouldApplyRemoteClientBootstrap(atcOrchestratorMode) &&
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

interface OrchestratorInit {
  runtimeOptions?: E2ERuntimeOptions;
  server?: Partial<ServerOptions>;
  client?: Partial<ClientOptions>;
}

export class Orchestrator {
  readonly mode: OrchestratorMode;

  private runtimeOptions: E2ERuntimeOptions;
  private serverOverrides: Partial<ServerOptions>;
  private clientOverrides: Partial<ClientOptions>;
  unrealLagOptions?: UnrealLagProxyOptions;

  constructor(mode: OrchestratorMode, init: OrchestratorInit = {}) {
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
    if (this.mode === OrchestratorMode.ListenServer && server.extraArgs) {
      server.extraArgs = server.extraArgs.filter((a) => a !== '-server');
    }
    return server;
  }

  buildClientOptions(projectPath: string) {
    return mergeClientOptions(RuntimePresets.Client(projectPath), this.clientOverrides);
  }
}

export class ATO {
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
        description:
          'UDP port the server should bind to; the orchestrator waits for this port before launching clients',
      })
      .option('timeout', {
        type: 'number',
        description: 'Seconds to wait for the server to bind the UDP port before failing',
      })
      .option('serverExe', {
        type: 'string',
        description:
          'Optional override path to the server executable; otherwise the orchestrator probes common project locations',
      })
      .option('clientExe', {
        type: 'string',
        description:
          'Optional override path to the client executable; otherwise the orchestrator probes common locations',
      })
      .option('dryRun', {
        type: 'boolean',
        default: false,
        description: 'Print planned actions and exit without spawning processes (useful for CI validation)',
      })
      .help()
      .parseSync() as unknown as ParsedCommandLineArguments;

    const projectPath = argv.Project;
    return new ATO({
      commandLineContext: {
        ueRoot: argv.UERoot,
        projectPath,
        projectRoot: path.dirname(projectPath),
      },
      runtimeOptions: {
        clientCount: argv.clients ?? options.clientCount,
        port: argv.port ?? options.port,
        timeoutSeconds: argv.timeout ?? options.timeoutSeconds,
        serverExe: argv.serverExe ?? options.serverExe,
        clientExe: argv.clientExe ?? options.clientExe,
        dryRun: argv.dryRun ?? options.dryRun,
      },
    });
  }

  orchestrators: Orchestrator[] = [];
  serverProc?: ChildProcess;
  unrealLag?: UnrealLag;
  unrealLagBindInfo?: BindInfo;

  private runtimeOptions: E2ERuntimeOptions;
  public readonly commandLineContext?: E2ECommandLineContext;

  constructor(init: ATOInit = {}) {
    this.runtimeOptions = { ...init.runtimeOptions };
    this.commandLineContext = init.commandLineContext;
  }

  get ueRoot() {
    return this.commandLineContext?.ueRoot ?? '';
  }

  get projectPath() {
    return this.commandLineContext?.projectPath ?? '';
  }

  configureRuntime(opts: E2ERuntimeOptions) {
    this.runtimeOptions = {
      ...this.runtimeOptions,
      ...opts,
    };
    return this;
  }

  addOrchestrator(orchestrator: Orchestrator) {
    this.orchestrators.push(orchestrator);
    return this;
  }

  preview() {
    if (this.orchestrators.length === 0) {
      return [];
    }

    return this.resolveLaunchPlans().map((plan) => plan.preview);
  }

  async start(): Promise<number> {
    if (this.orchestrators.length === 0) {
      console.error('No orchestrators configured');
      return 2;
    }

    let plans: ResolvedLaunchPlan[];
    try {
      plans = this.resolveLaunchPlans();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return 8;
    }

    let finalExitCode = 0;
    for (const plan of plans) {
      if (plan.dryRun) {
        this.printDryRunPreview(plan.preview, plan.atcOrchestratorMode);
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
    return this.orchestrators.map((orchestrator) => this.resolveLaunchPlan(orchestrator));
  }

  private resolveLaunchPlan(orchestrator: Orchestrator): ResolvedLaunchPlan {
    const effectiveRuntimeOptions = {
      ...this.runtimeOptions,
      ...orchestrator.resolveRuntimeOptions(),
    };
    const effectivePort = effectiveRuntimeOptions.port ?? 7777;
    const serverOptions = orchestrator.buildServerOptions(this.projectPath);
    const effectiveTimeout = effectiveRuntimeOptions.timeoutSeconds ?? serverOptions.timeoutSeconds ?? 60;
    const atcOrchestratorMode = orchestrator.mode;
    const maxExternalClients = resolveMaxExternalClientCount(atcOrchestratorMode, effectiveRuntimeOptions.clientCount);

    const server = this.resolveServerOptions(orchestrator, atcOrchestratorMode, effectiveRuntimeOptions);
    const clientTemplate = this.resolveClientTemplate(orchestrator, atcOrchestratorMode, effectiveRuntimeOptions);

    return {
      effectivePort,
      effectiveTimeout,
      server,
      clientTemplate,
      atcOrchestratorMode,
      maxExternalClients,
      preview: this.buildPreview(
        server,
        clientTemplate,
        maxExternalClients,
        effectivePort,
        effectiveTimeout,
        atcOrchestratorMode,
        orchestrator.unrealLagOptions,
      ),
      dryRun: effectiveRuntimeOptions.dryRun ?? false,
      unrealLagOptions: orchestrator.unrealLagOptions,
    };
  }

  private resolveServerOptions(
    orchestrator: Orchestrator,
    atcOrchestratorMode: OrchestratorMode,
    runtimeOptions: E2ERuntimeOptions,
  ): ResolvedServerOptions {
    const serverOptions = orchestrator.buildServerOptions(this.projectPath);

    return {
      ...serverOptions,
      execTests: [...(serverOptions.execTests ?? [])],
      exe: findFirstExisting(this.getPrimaryCandidates(serverOptions, atcOrchestratorMode, runtimeOptions)),
    };
  }

  private resolveClientTemplate(
    orchestrator: Orchestrator,
    atcOrchestratorMode: OrchestratorMode,
    runtimeOptions: E2ERuntimeOptions,
  ) {
    if (!shouldApplyRemoteClientBootstrap(atcOrchestratorMode)) {
      return undefined;
    }

    const clientOptions = orchestrator.buildClientOptions(this.projectPath);
    return {
      ...clientOptions,
      exe: findFirstExisting(this.getClientCandidates(clientOptions, runtimeOptions)),
      host: clientOptions.host ?? '127.0.0.1',
    } satisfies ResolvedClientTemplate;
  }

  /**
   * Determines the primary candidates for server executable based on orchestrator mode and runtime options.
   */
  private getPrimaryCandidates(
    serverOptions: ServerOptions,
    atcOrchestratorMode: OrchestratorMode,
    runtimeOptions: E2ERuntimeOptions,
  ) {
    if (usesDedicatedServerExecutable(atcOrchestratorMode)) {
      return this.getDedicatedServerCandidates(serverOptions, runtimeOptions);
    }

    // For Standalone and ListenServer modes we want the game's regular executable (e.g. TemplateProject.exe),
    // not the server executable which usually ends with "Server.exe".
    if (atcOrchestratorMode === OrchestratorMode.Standalone || atcOrchestratorMode === OrchestratorMode.ListenServer) {
      return this.getStandaloneCandidates(serverOptions, runtimeOptions);
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
    atcOrchestratorMode: OrchestratorMode,
    unrealLagOptions: UnrealLagProxyOptions | undefined,
  ): ResolvedPreview {
    const serverArgs = buildServerArgs(
      serverOptions,
      requiresNetworkServer(atcOrchestratorMode) ? port : undefined,
      atcOrchestratorMode,
    );
    const unrealLagPreview = this.buildUnrealLagPreview(port, timeoutSeconds, atcOrchestratorMode, unrealLagOptions);
    const proxyHost = unrealLagPreview
      ? this.formatProxyHost(unrealLagPreview.bindAddress, unrealLagPreview.bindPort)
      : undefined;

    const serverPreview = {
      exe: serverOptions.exe,
      args: serverArgs,
      command: formatCommand(serverOptions.exe, serverArgs),
    };

    const clientTemplatePreview = clientTemplate
      ? (() => {
          const client = resolveClientLaunchOptions(clientTemplate, 0);
          const args = buildClientArgs(client, proxyHost, atcOrchestratorMode);
          return {
            exe: client.exe,
            args,
            command: formatCommand(client.exe, args),
          } satisfies ResolvedPreviewCommand;
        })()
      : undefined;

    const clientPreviews =
      clientTemplate && maxExternalClients !== undefined
        ? Array.from({ length: maxExternalClients }, (_, clientIndex) => {
            const client = resolveClientLaunchOptions(clientTemplate, clientIndex);
            const args = buildClientArgs(client, proxyHost, atcOrchestratorMode);
            return {
              exe: client.exe,
              args,
              command: formatCommand(client.exe, args),
            } satisfies ResolvedPreviewCommand;
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
    atcOrchestratorMode: OrchestratorMode | undefined,
    unrealLagOptions: UnrealLagProxyOptions | undefined,
  ) {
    if (!unrealLagOptions || (atcOrchestratorMode && !requiresNetworkServer(atcOrchestratorMode))) return undefined;

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

  private printDryRunPreview(preview: ResolvedPreview, atcOrchestratorMode: OrchestratorMode) {
    const orchestratorLabel = resolveOrchestratorProcessLabel(atcOrchestratorMode);
    if (preview.unrealLag) {
      console.log('[DRYRUN] UnrealLag ->', JSON.stringify(preview.unrealLag));
    }
    console.log(`[DRYRUN] ${orchestratorLabel} -> ${preview.server.command}`);
    console.log(`[DRYRUN-ARGS] ${orchestratorLabel} ARGS:`, JSON.stringify(preview.server.args));
    if (preview.clientTemplate) {
      console.log(
        `[DRYRUN] Client Template -> ${preview.clientTemplate.command} (max=${String(preview.maxExternalClients ?? 0)})`,
      );
      console.log('[DRYRUN-ARGS] Client Template ARGS:', JSON.stringify(preview.clientTemplate.args));
    }
    preview.clients.forEach((client, index) => {
      console.log(`[DRYRUN] Client ${index + 1} -> ${client.command}`);
      console.log(`[DRYRUN-ARGS] Client ${index + 1} ARGS:`, JSON.stringify(client.args));
    });
  }

  private validateExecutables(plan: ResolvedLaunchPlan) {
    if (!checkExistsSync(plan.server.exe)) {
      console.error(`Server executable not found: ${plan.server.exe}`);
      return false;
    }

    if (plan.clientTemplate && !checkExistsSync(plan.clientTemplate.exe)) {
      console.error(`Client executable not found: ${plan.clientTemplate.exe}`);
      return false;
    }

    return true;
  }

  private createMonitoredProcess(
    exe: string,
    args: string[],
    label: string,
    timeoutSeconds: number,
    expectAutomation: boolean,
  ) {
    const automation = createAutomationObservationState(expectAutomation);
    const atc: ATCObservationState = {
      requestedRemoteClients: 0,
    };
    const observeLine = (line: string) => {
      observeAutomationLogLine(automation, line);
      const metadata = parseATCClientRequestMetadataLine(line);
      if (metadata) {
        atc.requestedRemoteClients = Math.max(atc.requestedRemoteClients, metadata.requiredClients);
      }
    };
    const process = spawnProcess(exe, args, label, {
      onStdoutLine: observeLine,
      onStderrLine: observeLine,
    });
    const exitPromise = promiseProcessExitOrTimeout(process, timeoutSeconds, () => {
      console.error(`${label} exceeded maxLifetime (${timeoutSeconds}s); killing process`);
      try {
        if (process && !process.killed) process.kill();
      } catch {}
    });

    return {
      label,
      process,
      automation,
      atc,
      exitPromise,
    } satisfies MonitoredProcess;
  }

  private async startResolvedPlan(plan: ResolvedLaunchPlan): Promise<number> {
    const outcomes: ProcessOutcome[] = [];
    let serverMonitor: MonitoredProcess | undefined;
    const clientMonitors: MonitoredProcess[] = [];
    const orchestratorLabel = resolveOrchestratorProcessLabel(plan.atcOrchestratorMode);

    try {
      const bootstrapOrchestration = isATCBootstrapOrchestration(
        plan.server,
        plan.clientTemplate,
        plan.atcOrchestratorMode,
      );
      const serverMaxLifetime = plan.server.maxLifetime ?? 600;
      const proxyClientHost = requiresNetworkServer(plan.atcOrchestratorMode)
        ? await this.startUnrealLag(plan.effectivePort, plan.unrealLagOptions)
        : undefined;

      const serverArgs = buildServerArgs(
        plan.server,
        requiresNetworkServer(plan.atcOrchestratorMode) ? plan.effectivePort : undefined,
        plan.atcOrchestratorMode,
      );
      console.log(`[SPAWN] ${orchestratorLabel} -> ${formatCommand(plan.server.exe, serverArgs)}`);
      console.log(`[SPAWN-ARGS] ${orchestratorLabel} ARGS:`, JSON.stringify(serverArgs));
      serverMonitor = this.createMonitoredProcess(
        plan.server.exe,
        serverArgs,
        orchestratorLabel,
        serverMaxLifetime,
        hasAutomationCommands(plan.server),
      );
      this.serverProc = serverMonitor.process;

      const serverPid = this.serverProc.pid ?? -1;
      if (serverPid <= 0) {
        console.error('Failed to obtain server PID');
        outcomes.push({
          label: orchestratorLabel,
          rawExitResult: -1,
          effectiveExitCode: FAILURE_EXIT_CODE,
          reason: 'failed to obtain server pid',
          automation: serverMonitor.automation,
        });
        return FAILURE_EXIT_CODE;
      }

      if (requiresImmediateNetworkServer(plan.server, plan.atcOrchestratorMode)) {
        const serverStatus = await this.waitForServerReady(
          serverPid,
          plan.effectivePort,
          plan.effectiveTimeout,
          serverMonitor.exitPromise,
        );
        if (serverStatus !== 'bound') {
          try {
            if (this.serverProc && !this.serverProc.killed) this.serverProc.kill();
          } catch {}
          const finalServerExit = await serverMonitor.exitPromise;
          outcomes.push(
            summarizeStartupFailureOutcome(orchestratorLabel, finalServerExit, serverMonitor.automation, serverStatus),
          );
          return this.handleServerStartupFailure(serverStatus);
        }
      }

      if (bootstrapOrchestration) {
        if (
          plan.atcOrchestratorMode === OrchestratorMode.DedicatedServer &&
          plan.clientTemplate &&
          plan.maxExternalClients !== undefined &&
          clientMonitors.length < plan.maxExternalClients
        ) {
          this.spawnClients(
            plan.clientTemplate,
            clientMonitors.length,
            plan.maxExternalClients,
            plan.atcOrchestratorMode,
            proxyClientHost,
            clientMonitors,
          );
        }

        const bootstrapRequestResult = await this.monitorATCClientRequestsUntilAutomationTerminal(
          plan.clientTemplate,
          plan.maxExternalClients,
          plan.atcOrchestratorMode,
          proxyClientHost,
          clientMonitors,
          serverMonitor,
          serverMaxLifetime,
        );

        await this.waitForClientAutomationTerminalState(clientMonitors, 15);

        try {
          if (this.serverProc && !this.serverProc.killed) {
            this.serverProc.kill();
          }
        } catch {}

        for (const monitor of clientMonitors) {
          try {
            if (!monitor.process.killed) {
              monitor.process.kill();
            }
          } catch {}
        }

        const finalServerExit = await serverMonitor.exitPromise;
        outcomes.unshift(summarizeProcessOutcome(orchestratorLabel, finalServerExit, serverMonitor.automation));

        const clientOutcomes = await this.waitForClientMonitors(clientMonitors);
        outcomes.push(...clientOutcomes);

        if (!bootstrapRequestResult) {
          return FAILURE_EXIT_CODE;
        }

        return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
      }

      if (!plan.clientTemplate) {
        const finalServerExit = await serverMonitor.exitPromise;
        outcomes.unshift(summarizeProcessOutcome(orchestratorLabel, finalServerExit, serverMonitor.automation));
        return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
      }

      const eagerClientCount = plan.maxExternalClients ?? 0;
      if (clientMonitors.length < eagerClientCount) {
        this.spawnClients(
          plan.clientTemplate,
          clientMonitors.length,
          eagerClientCount,
          plan.atcOrchestratorMode,
          proxyClientHost,
          clientMonitors,
        );
      }

      const clientOutcomes = await this.waitForClientMonitors(clientMonitors, serverMonitor);
      outcomes.push(...clientOutcomes);

      try {
        if (this.serverProc && !this.serverProc.killed) this.serverProc.kill();
      } catch {}

      const finalServerExit = await serverMonitor.exitPromise;
      outcomes.unshift(summarizeProcessOutcome(orchestratorLabel, finalServerExit, serverMonitor.automation));
      return outcomes.some((outcome) => outcome.effectiveExitCode !== 0) ? FAILURE_EXIT_CODE : 0;
    } finally {
      try {
        if (this.serverProc && !this.serverProc.killed) this.serverProc.kill();
      } catch {}
      await this.stopUnrealLag();
      printOrchestrationSummary(outcomes);
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
    console.log(
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
  ) {
    const serverBindPromise = (async () => {
      try {
        await waitForUdpPort(serverPid, port, timeoutSeconds);
        console.log('Server bound UDP port', port);
        return 'bound' as const;
      } catch (error) {
        console.error('Server failed to bind UDP port', error);
        return 'bind-failed' as const;
      }
    })();

    return Promise.race([serverBindPromise, serverExitPromise]);
  }

  private async handleServerStartupFailure(status: number | 'timeout' | 'bind-failed') {
    if (status === 'bind-failed' || status === 'timeout') {
      console.error('Server failed to come up in time or exceeded lifetime');
    } else {
      console.error('Server exited before binding the expected UDP port', status);
    }
    try {
      if (this.serverProc && !this.serverProc.killed) this.serverProc.kill();
    } catch {}
    await this.stopUnrealLag();
    return FAILURE_EXIT_CODE;
  }

  private spawnClients(
    clientTemplate: ResolvedClientTemplate,
    fromIndex: number,
    toExclusiveIndex: number,
    atcOrchestratorMode: OrchestratorMode,
    proxyClientHost: string | undefined,
    clientMonitors: MonitoredProcess[],
  ) {
    for (let clientIndex = fromIndex; clientIndex < toExclusiveIndex; clientIndex += 1) {
      const client = resolveClientLaunchOptions(clientTemplate, clientIndex);
      const args = buildClientArgs(client, proxyClientHost, atcOrchestratorMode);
      const prefix = `CLIENT ${client.clientIndex}`;
      console.log(`[SPAWN] ${prefix} -> ${formatCommand(client.exe, args)}`);
      console.log(`[SPAWN-ARGS] ${prefix} ARGS:`, JSON.stringify(args));
      clientMonitors.push(
        this.createMonitoredProcess(
          client.exe,
          args,
          prefix,
          client.maxLifetime ?? 300,
          (client.execTests?.length ?? 0) > 0,
        ),
      );
    }
  }

  private async monitorATCClientRequestsUntilAutomationTerminal(
    clientTemplate: ResolvedClientTemplate | undefined,
    maxExternalClients: number | undefined,
    atcOrchestratorMode: OrchestratorMode,
    proxyClientHost: string | undefined,
    clientMonitors: MonitoredProcess[],
    serverMonitor: MonitoredProcess,
    timeoutSeconds: number,
  ) {
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      const requestedRemoteClients = serverMonitor.atc.requestedRemoteClients;
      if (requestedRemoteClients > 0 && !clientTemplate) {
        console.error(
          `[ATO] ATC requested ${requestedRemoteClients} remote client(s), but this orchestrator mode does not provide external clients`,
        );
        try {
          if (!serverMonitor.process.killed) {
            serverMonitor.process.kill();
          }
        } catch {}
        await serverMonitor.exitPromise;
        return false;
      }

      if (maxExternalClients !== undefined && requestedRemoteClients > maxExternalClients) {
        console.error(
          `[ATO] ATC requested ${requestedRemoteClients} remote client(s), but the configured maximum is ${maxExternalClients}`,
        );
        try {
          if (!serverMonitor.process.killed) {
            serverMonitor.process.kill();
          }
        } catch {}
        await serverMonitor.exitPromise;
        return false;
      }

      if (clientTemplate && clientMonitors.length < requestedRemoteClients) {
        this.spawnClients(
          clientTemplate,
          clientMonitors.length,
          requestedRemoteClients,
          atcOrchestratorMode,
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

    console.error(`[ATO] Timed out waiting for ${serverMonitor.label} automation to reach a terminal state`);
    try {
      if (!serverMonitor.process.killed) {
        serverMonitor.process.kill();
      }
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
          console.error(
            `${serverMonitor.label} exited before all clients completed (${completion.serverExit}); terminating remaining clients`,
          );
        }
        for (const monitor of pendingClients) {
          try {
            monitor.process.kill();
          } catch {}
        }
      }
    }

    const rawClientResults = await allClientExitResults;
    return rawClientResults.map((rawExitResult, index) =>
      summarizeProcessOutcome(clientMonitors[index].label, rawExitResult, clientMonitors[index].automation),
    );
  }
}
