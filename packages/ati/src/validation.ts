import type { ATCEvent, ATCParameterBinding } from './ATIEvents.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(record: Record<string, unknown>, key: string, required = false) {
  const value = record[key];
  if (value === undefined) {
    if (required) {
      throw new TypeError(`ATI event is missing required string field '${key}'`);
    }
    return;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`ATI event field '${key}' must be a string`);
  }
}

function assertNumber(record: Record<string, unknown>, key: string, required = false) {
  const value = record[key];
  if (value === undefined) {
    if (required) {
      throw new TypeError(`ATI event is missing required numeric field '${key}'`);
    }
    return;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`ATI event field '${key}' must be a finite number`);
  }
}

function assertBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`ATI event field '${key}' must be a boolean`);
  }
}

function isParameterBinding(value: unknown): value is ATCParameterBinding {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.name === 'string' && typeof value.value === 'string';
}

function assertParameterBindings(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || !value.every(isParameterBinding)) {
    throw new TypeError(`ATI event field '${key}' must be an array of { name, value } bindings`);
  }
}

function assertStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new TypeError(`ATI event field '${key}' must be an array of strings`);
  }
}

const optionalStringFields = [
  'testId',
  'testPath',
  'travelSessionId',
  'coordinatorMode',
  'effectiveCoordinatorMode',
  'processRole',
  'phase',
  'message',
  'planName',
  'taskName',
  'taskTarget',
  'taskRole',
  'status',
  'reason',
  'kind',
  'state',
  'repeatMode',
  'stopReason',
  'timeoutType',
  'participantKind',
  'participantName',
  'sourceFile',
  'sourceFunction',
] as const;

const optionalNumberFields = [
  'invocationIndex',
  'requiredClients',
  'attempt',
  'maxRetries',
  'retriesRemaining',
  'targetClientIndex',
  'sourceClientIndex',
  'currentRun',
  'completedRuns',
  'executedRuns',
  'skippedRuns',
  'totalRuns',
  'afterRun',
  'nextRun',
  'skipRunsRequested',
  'messageCount',
  'durationSeconds',
  'retryDelaySeconds',
  'delaySeconds',
  'taskTimeoutSeconds',
  'timeoutSeconds',
  'currentVariant',
  'totalVariants',
  'connectedClients',
  'readyClients',
  'sourceLine',
] as const;

const optionalBooleanFields = ['success', 'skipped', 'failed', 'skipAllRemainingRuns', 'testSkipRequested'] as const;

export function parseATCEvent(input: string | Record<string, unknown>): ATCEvent {
  const parsed = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!isRecord(parsed)) {
    throw new TypeError('ATI event payload must be a JSON object');
  }

  assertNumber(parsed, 'version', true);
  if (parsed.version !== 1) {
    throw new TypeError(`Unsupported ATI event version '${JSON.stringify(parsed.version)}'`);
  }

  assertString(parsed, 'sessionId', true);
  assertNumber(parsed, 'sequence', true);
  assertNumber(parsed, 'timestamp', true);
  assertString(parsed, 'type', true);

  for (const field of optionalStringFields) {
    assertString(parsed, field);
  }

  for (const field of optionalNumberFields) {
    assertNumber(parsed, field);
  }

  for (const field of optionalBooleanFields) {
    assertBoolean(parsed, field);
  }

  assertParameterBindings(parsed, 'parameters');
  assertParameterBindings(parsed, 'metadata');
  assertStringArray(parsed, 'modes');

  return parsed as unknown as ATCEvent;
}
