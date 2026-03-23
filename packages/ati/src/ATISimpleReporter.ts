import type { ATCEvent, ATCParameterBinding } from './ATIEvents';

export type ATIAssertionResult = {
  message: string;
  file?: string;
  line?: number;
  sourceFunction?: string;
  sourceClientIndex?: number;
};

export type ATITaskAttemptStatus = 'Queued' | 'Running' | 'Retrying' | 'Passed' | 'Failed' | 'Skipped' | 'TimedOut';

export type ATITaskAttempt = {
  attempt: number;
  sourceClientIndex?: number;
  sourceFile?: string;
  sourceLine?: number;
  sourceFunction?: string;
  status?: ATITaskAttemptStatus;
  startTime?: number;
  endTime?: number;
  durationSeconds?: number;
  message?: string;
  success?: boolean;
  skipped?: boolean;
  timedOut?: boolean;
  taskTarget?: string;
  taskRole?: string;
  targetClientIndex?: number;
  maxRetries?: number;
  retriesRemaining?: number;
  retryDelaySeconds?: number;
  timeoutSeconds?: number;
  assertionErrors: ATIAssertionResult[];
  assertionWarnings: ATIAssertionResult[];
};

export type ATITask = {
  taskName: string;
  attempts: ATITaskAttempt[];
};

export type ATIPlan = {
  planName: string;
  status?: 'Queued' | 'Running' | 'Passed' | 'Failed';
  success?: boolean;
  reason?: string;
  message?: string;
  failedTasks?: string;
  completedTasks?: number;
  skippedTasks?: number;
  tasks: Map<string, ATITask>;
};

export type ATITestExecution = {
  effectiveCoordinatorMode: string;
  coordinatorMode?: string;
  travelSessionId?: string;
  testId?: string;
  phase: string;
  currentVariant?: number;
  totalVariants?: number;
  result?: {
    success: boolean;
    skipped: boolean;
    message: string;
    sourceFile?: string;
    sourceLine?: number;
    sourceFunction?: string;
    durationSeconds?: number;
    messageCount?: number;
  };
  startedAt?: number;
  finishedAt?: number;
  plans: Map<string, ATIPlan>;
};

export type ATITestRun = {
  runIndex: number;
  status?: 'Queued' | 'Running' | 'Passed' | 'Failed' | 'Skipped';
  meta: {
    invocationIndex?: number;
    repeatMode?: string;
    totalRuns?: number;
    currentVariant?: number;
    totalVariants?: number;
    afterRun?: number;
    nextRun?: number;
    completedRuns?: number;
    executedRuns?: number;
    skippedRuns?: number;
    stopReason?: string;
  };
  executions: Map<string, ATITestExecution>;
};

export type ATITest = {
  key: string;
  testId?: string;
  testPath: string;
  invocationIndex?: number;
  coordinatorMode: string;
  effectiveCoordinatorModes: string[];
  phase: string;
  result?: {
    success: boolean;
    skipped: boolean;
    message: string;
    sourceFile?: string;
    sourceLine?: number;
    sourceFunction?: string;
    durationSeconds?: number;
    skipRunsRequested?: number;
    skipAllRemainingRuns?: boolean;
    messageCount?: number;
  };
  maxRuns?: number;
  repeatMode?: string;
  currentRunIndex: number;
  parameters: ATCParameterBinding[];
  metadata: ATCParameterBinding[];
  runs: ATITestRun[];
};

export type ATISession = {
  sessionId: string;
  startedAt?: number;
  endedAt?: number;
  coordinatorMode: string;
  effectiveCoordinatorModes: string[];
  tests: Map<string, ATITest>;
  testsByEffectiveCoordinatorMode: Map<string, Map<string, ATITest>>;
};

export type ATISimpleReporterListener = (event: ATCEvent, session: ATISession | undefined) => void;

type ReporterEvent = ATCEvent & Record<string, unknown>;

type ExecutionLocator = {
  testKey: string;
  runIndex: number;
  effectiveCoordinatorMode: string;
};

type MatrixState = {
  effectiveCoordinatorMode?: string;
  modes: string[];
  currentVariant?: number;
  totalVariants?: number;
};

function appendUnique(values: string[], value: string | undefined) {
  if (!value || values.includes(value)) {
    return;
  }

  values.push(value);
}

function cloneBindings(bindings?: ATCParameterBinding[]) {
  return bindings ? bindings.map((binding) => ({ ...binding })) : [];
}

function makeTestKey(testPath: string, invocationIndex: number | undefined) {
  return `${testPath}::${invocationIndex ?? 0}`;
}

function normalizeCoordinatorMode(value: string | undefined) {
  return value?.trim() || 'Unknown';
}

function getStringField(event: ReporterEvent, key: string) {
  const value = event[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(event: ReporterEvent, key: string) {
  const value = event[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBooleanField(event: ReporterEvent, key: string) {
  const value = event[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getStringArrayField(event: ReporterEvent, key: string) {
  const value = event[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? [...value] : [];
}

function normalizeSourceClientIndex(value: number | undefined) {
  return value !== undefined && value >= 0 ? value : undefined;
}

function resolveAttemptStatus(success: boolean | undefined, skipped: boolean | undefined) {
  if (skipped) {
    return 'Skipped' as const;
  }

  if (success) {
    return 'Passed' as const;
  }

  return 'Failed' as const;
}

function resolveMapSegment(current: Map<unknown, unknown>, segment: string | number) {
  if (current.has(segment)) {
    return current.get(segment);
  }

  const normalizedSegment = String(segment);
  for (const [key, value] of current.entries()) {
    if (String(key) === normalizedSegment) {
      return value;
    }

    if (typeof value !== 'object' || value === null) {
      continue;
    }

    const candidate = value as Record<string, unknown>;
    for (const identityKey of ['key', 'testPath', 'planName', 'taskName', 'effectiveCoordinatorMode', 'sessionId']) {
      if (String(candidate[identityKey] ?? '') === normalizedSegment) {
        return value;
      }
    }
  }

  throw new Error(`Unable to resolve simple reporter Map segment '${normalizedSegment}'`);
}

function resolveArraySegment(current: unknown[], segment: string | number) {
  if (typeof segment === 'number') {
    return current[segment];
  }

  if (/^\d+$/.test(segment)) {
    return current[Number.parseInt(segment, 10)];
  }

  const matched = current.find((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }

    const candidate = entry as Record<string, unknown>;
    return ['key', 'testPath', 'planName', 'taskName', 'effectiveCoordinatorMode', 'runIndex'].some(
      (identityKey) => String(candidate[identityKey] ?? '') === segment,
    );
  });

  if (matched !== undefined) {
    return matched;
  }

  throw new Error(`Unable to resolve simple reporter array segment '${segment}'`);
}

export class ATISimpleReporter {
  private session?: ATISession;
  private readonly executionIndex = new Map<string, ExecutionLocator>();
  private readonly currentRunIndexByTestKey = new Map<string, number>();
  private readonly matrixStateByTestPath = new Map<string, MatrixState>();
  private readonly listeners = new Set<ATISimpleReporterListener>();

  addEvent(event: ATCEvent) {
    const reporterEvent = event as ReporterEvent;

    try {
      switch (event.type) {
        case 'SessionStarted':
          this.handleSessionStarted(reporterEvent);
          return;
        case 'SessionFinished':
          this.handleSessionFinished(reporterEvent);
          return;
        case 'CoordinatorMatrix':
          this.handleCoordinatorMatrix(reporterEvent);
          return;
        case 'TestRepeat':
          this.handleTestRepeat(reporterEvent);
          return;
        case 'TestStarted':
          this.handleTestStarted(reporterEvent);
          return;
        case 'TestPhaseChanged':
          this.handleTestPhaseChanged(reporterEvent);
          return;
        case 'TestFinished':
          this.handleTestFinished(reporterEvent);
          return;
        case 'PlanStarted':
          this.handlePlanStarted(reporterEvent);
          return;
        case 'PlanFinished':
          this.handlePlanFinished(reporterEvent);
          return;
        case 'TaskDispatched':
          this.handleTaskDispatched(reporterEvent);
          return;
        case 'TaskStarted':
          this.handleTaskStarted(reporterEvent);
          return;
        case 'TaskResult':
          this.handleTaskResult(reporterEvent);
          return;
        case 'TaskRetry':
          this.handleTaskRetry(reporterEvent);
          return;
        case 'TaskTimeout':
          this.handleTaskTimeout(reporterEvent);
          return;
        case 'Message':
          this.handleMessage(reporterEvent);
          return;
        default:
          this.observeSessionMetadata(reporterEvent);
      }
    } finally {
      this.notifyListeners(event);
    }
  }

  getSession() {
    return this.session;
  }

  getBySimpleReporterPath(path: readonly (string | number)[]) {
    let current: unknown = this.session;
    for (const segment of path) {
      if (current instanceof Map) {
        current = resolveMapSegment(current, segment);
        continue;
      }

      if (Array.isArray(current)) {
        current = resolveArraySegment(current, segment);
        continue;
      }

      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[String(segment)];
        continue;
      }

      throw new Error(`Unable to resolve simple reporter path at segment '${String(segment)}'`);
    }

    return current;
  }

  reset() {
    this.session = undefined;
    this.executionIndex.clear();
    this.currentRunIndexByTestKey.clear();
    this.matrixStateByTestPath.clear();
  }

  subscribe(listener: ATISimpleReporterListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: ATCEvent) {
    for (const listener of this.listeners) {
      listener(event, this.session);
    }
  }

  private handleSessionStarted(event: ReporterEvent) {
    this.session = {
      sessionId: event.sessionId,
      startedAt: event.timestamp,
      coordinatorMode: normalizeCoordinatorMode(event.coordinatorMode),
      effectiveCoordinatorModes: [],
      tests: new Map(),
      testsByEffectiveCoordinatorMode: new Map(),
    };
    this.observeSessionMetadata(event);
  }

  private handleSessionFinished(event: ReporterEvent) {
    const session = this.ensureSession(event);
    session.endedAt = event.timestamp;
    this.observeSessionMetadata(event);
  }

  private handleCoordinatorMatrix(event: ReporterEvent) {
    const testPath = event.testPath;
    if (!testPath) {
      this.observeSessionMetadata(event);
      return;
    }

    const matrixState = this.matrixStateByTestPath.get(testPath) ?? { modes: [] };
    matrixState.effectiveCoordinatorMode = event.effectiveCoordinatorMode ?? matrixState.effectiveCoordinatorMode;
    matrixState.currentVariant = getNumberField(event, 'currentVariant') ?? matrixState.currentVariant;
    matrixState.totalVariants = getNumberField(event, 'totalVariants') ?? matrixState.totalVariants;
    for (const mode of getStringArrayField(event, 'modes')) {
      appendUnique(matrixState.modes, mode);
    }
    this.matrixStateByTestPath.set(testPath, matrixState);

    const test = this.tryGetTest(event);
    if (!test) {
      this.observeSessionMetadata(event);
      return;
    }

    for (const mode of matrixState.modes) {
      appendUnique(test.effectiveCoordinatorModes, mode);
      this.indexTestByEffectiveMode(mode, test);
    }

    const run = this.ensureRun(test, this.resolveRunIndex(event, test));
    run.meta.currentVariant = matrixState.currentVariant ?? run.meta.currentVariant;
    run.meta.totalVariants = matrixState.totalVariants ?? run.meta.totalVariants;

    if (matrixState.effectiveCoordinatorMode) {
      const execution = this.ensureExecution(run, test, event, matrixState.effectiveCoordinatorMode);
      execution.currentVariant = matrixState.currentVariant ?? execution.currentVariant;
      execution.totalVariants = matrixState.totalVariants ?? execution.totalVariants;
      const variantSuccess = getBooleanField(event, 'success');
      if (getStringField(event, 'state') === 'VariantEnd' && variantSuccess !== undefined) {
        const variantMessage = variantSuccess
          ? 'Coordinator matrix variant completed successfully'
          : 'Coordinator matrix variant failed';
        execution.result = execution.result ?? {
          success: variantSuccess,
          skipped: false,
          message: variantMessage,
        };
        execution.result.success = variantSuccess;
      }
    }

    this.observeSessionMetadata(event);
  }

  private handleTestRepeat(event: ReporterEvent) {
    const test = this.ensureTest(event);
    const runIndex = getNumberField(event, 'currentRun') ?? test.currentRunIndex ?? 1;
    const run = this.ensureRun(test, runIndex);
    run.meta.invocationIndex = event.invocationIndex ?? run.meta.invocationIndex;
    run.meta.repeatMode = getStringField(event, 'repeatMode') ?? run.meta.repeatMode;
    run.meta.totalRuns = getNumberField(event, 'totalRuns') ?? run.meta.totalRuns;
    run.meta.afterRun = getNumberField(event, 'afterRun') ?? run.meta.afterRun;
    run.meta.nextRun = getNumberField(event, 'nextRun') ?? run.meta.nextRun;
    run.meta.completedRuns = getNumberField(event, 'completedRuns') ?? run.meta.completedRuns;
    run.meta.executedRuns = getNumberField(event, 'executedRuns') ?? run.meta.executedRuns;
    run.meta.skippedRuns = getNumberField(event, 'skippedRuns') ?? run.meta.skippedRuns;
    run.meta.stopReason = getStringField(event, 'stopReason') ?? run.meta.stopReason;
    test.maxRuns = getNumberField(event, 'totalRuns') ?? test.maxRuns;
    test.repeatMode = getStringField(event, 'repeatMode') ?? test.repeatMode;

    switch (getStringField(event, 'state')) {
      case 'RunStart':
        run.status = 'Running';
        test.currentRunIndex = runIndex;
        test.phase = 'Queued';
        test.result = undefined;
        this.currentRunIndexByTestKey.set(test.key, runIndex);
        break;
      case 'RunEnd': {
        const skipped = getBooleanField(event, 'skipped') ?? false;
        const failed = getBooleanField(event, 'failed') ?? false;
        if (skipped) {
          run.status = 'Skipped';
        } else if (failed) {
          run.status = 'Failed';
        } else {
          run.status = 'Passed';
        }
        break;
      }
      case 'RunsSkipped':
        run.status = run.status ?? 'Queued';
        break;
      case 'Complete':
        if (test.currentRunIndex < runIndex) {
          test.currentRunIndex = runIndex;
        }
        break;
    }

    this.observeSessionMetadata(event);
  }

  private handleTestStarted(event: ReporterEvent) {
    const test = this.ensureTest(event);
    const run = this.ensureRun(test, this.resolveRunIndex(event, test));
    test.result = undefined;
    if (test.phase === 'Completed') {
      test.phase = 'Queued';
    }
    run.status = 'Running';
    const execution = this.ensureExecution(run, test, event);
    execution.startedAt = event.timestamp;
    execution.phase = test.phase;
    execution.coordinatorMode = event.coordinatorMode ?? execution.coordinatorMode;
    execution.testId = event.testId ?? execution.testId;
    execution.travelSessionId = event.travelSessionId ?? execution.travelSessionId;
    this.indexExecutionIdentifiers(test.key, run.runIndex, execution.effectiveCoordinatorMode, event);
    this.observeSessionMetadata(event);
  }

  private handleTestPhaseChanged(event: ReporterEvent) {
    const test = this.ensureTest(event);
    const phase = getStringField(event, 'phase');
    if (phase) {
      test.phase = phase;
    }

    const run = this.ensureRun(test, this.resolveRunIndex(event, test));
    const execution = this.ensureExecution(run, test, event);
    execution.phase = phase ?? execution.phase;
    this.observeSessionMetadata(event);
  }

  private handleTestFinished(event: ReporterEvent) {
    const test = this.ensureTest(event);
    test.phase = 'Completed';
    test.result = {
      success: getBooleanField(event, 'success') ?? false,
      skipped: getBooleanField(event, 'skipped') ?? false,
      message: getStringField(event, 'message') ?? '',
      sourceFile: getStringField(event, 'sourceFile'),
      sourceLine: getNumberField(event, 'sourceLine'),
      sourceFunction: getStringField(event, 'sourceFunction'),
      durationSeconds: getNumberField(event, 'durationSeconds'),
      skipRunsRequested: getNumberField(event, 'skipRunsRequested'),
      skipAllRemainingRuns: getBooleanField(event, 'skipAllRemainingRuns'),
      messageCount: getNumberField(event, 'messageCount'),
    };

    const run = this.ensureRun(test, this.resolveRunIndex(event, test));
    run.status = resolveAttemptStatus(test.result.success, test.result.skipped);
    const execution = this.ensureExecution(run, test, event);
    execution.phase = 'Completed';
    execution.finishedAt = event.timestamp;
    execution.result = {
      success: test.result.success,
      skipped: test.result.skipped,
      message: test.result.message,
      sourceFile: test.result.sourceFile,
      sourceLine: test.result.sourceLine,
      sourceFunction: test.result.sourceFunction,
      durationSeconds: test.result.durationSeconds,
      messageCount: test.result.messageCount,
    };
    this.observeSessionMetadata(event);
  }

  private handlePlanStarted(event: ReporterEvent) {
    const planName = getStringField(event, 'planName');
    if (!planName) {
      this.observeSessionMetadata(event);
      return;
    }

    const execution = this.ensureExecutionForEvent(event);
    const plan = this.ensurePlan(execution, planName);
    plan.status = 'Running';
    this.observeSessionMetadata(event);
  }

  private handlePlanFinished(event: ReporterEvent) {
    const planName = getStringField(event, 'planName');
    if (!planName) {
      this.observeSessionMetadata(event);
      return;
    }

    const execution = this.ensureExecutionForEvent(event);
    const plan = this.ensurePlan(execution, planName);
    const success = getBooleanField(event, 'success');
    plan.status = success ? 'Passed' : 'Failed';
    plan.success = success;
    plan.reason = getStringField(event, 'reason') ?? plan.reason;
    plan.message = getStringField(event, 'message') ?? plan.message;
    plan.failedTasks = getStringField(event, 'failedTasks') ?? plan.failedTasks;
    plan.completedTasks = getNumberField(event, 'completedTasks') ?? plan.completedTasks;
    plan.skippedTasks = getNumberField(event, 'skippedTasks') ?? plan.skippedTasks;
    this.observeSessionMetadata(event);
  }

  private handleTaskDispatched(event: ReporterEvent) {
    const task = this.ensureTaskForEvent(event);
    const attempt = this.ensureAttempt(
      task,
      getNumberField(event, 'attempt') ?? 1,
      normalizeSourceClientIndex(getNumberField(event, 'targetClientIndex')),
    );
    attempt.status = attempt.status ?? 'Queued';
    attempt.taskTarget = getStringField(event, 'taskTarget') ?? attempt.taskTarget;
    attempt.taskRole = getStringField(event, 'taskRole') ?? attempt.taskRole;
    attempt.targetClientIndex = getNumberField(event, 'targetClientIndex') ?? attempt.targetClientIndex;
    attempt.maxRetries = getNumberField(event, 'maxRetries') ?? attempt.maxRetries;
    attempt.retryDelaySeconds = getNumberField(event, 'retryDelaySeconds') ?? attempt.retryDelaySeconds;
    attempt.timeoutSeconds = getNumberField(event, 'taskTimeoutSeconds') ?? attempt.timeoutSeconds;
    this.observeSessionMetadata(event);
  }

  private handleTaskStarted(event: ReporterEvent) {
    const task = this.ensureTaskForEvent(event);
    const attempt = this.ensureAttempt(
      task,
      getNumberField(event, 'attempt') ?? 1,
      normalizeSourceClientIndex(getNumberField(event, 'sourceClientIndex')),
    );
    attempt.status = 'Running';
    attempt.startTime = event.timestamp;
    attempt.taskTarget = getStringField(event, 'taskTarget') ?? attempt.taskTarget;
    this.observeSessionMetadata(event);
  }

  private handleTaskResult(event: ReporterEvent) {
    const task = this.ensureTaskForEvent(event);
    const attempt = this.resolveAttempt(
      task,
      getNumberField(event, 'attempt') ?? 1,
      normalizeSourceClientIndex(getNumberField(event, 'sourceClientIndex')),
      true,
    );
    attempt.endTime = event.timestamp;
    attempt.durationSeconds = getNumberField(event, 'durationSeconds') ?? attempt.durationSeconds;
    attempt.message = getStringField(event, 'message') ?? attempt.message;
    attempt.sourceFile = getStringField(event, 'sourceFile') ?? attempt.sourceFile;
    attempt.sourceLine = getNumberField(event, 'sourceLine') ?? attempt.sourceLine;
    attempt.sourceFunction = getStringField(event, 'sourceFunction') ?? attempt.sourceFunction;
    attempt.success = getBooleanField(event, 'success');
    attempt.skipped = getBooleanField(event, 'skipped');
    attempt.maxRetries = getNumberField(event, 'maxRetries') ?? attempt.maxRetries;
    attempt.status = resolveAttemptStatus(attempt.success, attempt.skipped);
    this.observeSessionMetadata(event);
  }

  private handleTaskRetry(event: ReporterEvent) {
    const task = this.ensureTaskForEvent(event);
    const attempt = this.resolveAttempt(
      task,
      getNumberField(event, 'failedAttempt') ?? getNumberField(event, 'attempt') ?? 1,
      undefined,
      true,
    );
    attempt.status = 'Retrying';
    attempt.message = getStringField(event, 'message') ?? attempt.message;
    attempt.sourceFile = getStringField(event, 'sourceFile') ?? attempt.sourceFile;
    attempt.sourceLine = getNumberField(event, 'sourceLine') ?? attempt.sourceLine;
    attempt.sourceFunction = getStringField(event, 'sourceFunction') ?? attempt.sourceFunction;
    attempt.maxRetries = getNumberField(event, 'maxRetries') ?? attempt.maxRetries;
    attempt.retriesRemaining = getNumberField(event, 'retriesRemaining') ?? attempt.retriesRemaining;
    attempt.retryDelaySeconds = getNumberField(event, 'delaySeconds') ?? attempt.retryDelaySeconds;
    this.observeSessionMetadata(event);
  }

  private handleTaskTimeout(event: ReporterEvent) {
    const task = this.ensureTaskForEvent(event);
    const attempt = this.resolveLatestAttempt(task, undefined, true);
    attempt.status = 'TimedOut';
    attempt.endTime = event.timestamp;
    attempt.timedOut = true;
    attempt.timeoutSeconds = getNumberField(event, 'timeoutSeconds') ?? attempt.timeoutSeconds;
    attempt.message = getStringField(event, 'message') ?? attempt.message;
    attempt.sourceFile = getStringField(event, 'sourceFile') ?? attempt.sourceFile;
    attempt.sourceLine = getNumberField(event, 'sourceLine') ?? attempt.sourceLine;
    attempt.sourceFunction = getStringField(event, 'sourceFunction') ?? attempt.sourceFunction;
    this.observeSessionMetadata(event);
  }

  private handleMessage(event: ReporterEvent) {
    const planName = getStringField(event, 'planName');
    const taskName = getStringField(event, 'taskName');
    const message = getStringField(event, 'message');
    if (!planName || !taskName || !message) {
      this.observeSessionMetadata(event);
      return;
    }

    const task = this.ensureTaskForEvent(event);
    const sourceClientIndex = normalizeSourceClientIndex(getNumberField(event, 'sourceClientIndex'));
    const attempt = this.resolveLatestAttempt(task, sourceClientIndex, true);
    const assertion: ATIAssertionResult = { message };
    const sourceFile = getStringField(event, 'sourceFile');
    if (sourceFile) {
      assertion.file = sourceFile;
    }
    const sourceLine = getNumberField(event, 'sourceLine');
    if (sourceLine !== undefined) {
      assertion.line = sourceLine;
    }
    const sourceFunction = getStringField(event, 'sourceFunction');
    if (sourceFunction) {
      assertion.sourceFunction = sourceFunction;
    }
    if (sourceClientIndex !== undefined) {
      assertion.sourceClientIndex = sourceClientIndex;
    }

    const kind = getStringField(event, 'kind');
    if (kind === 'FatalError' || kind === 'NonFatalError') {
      attempt.assertionErrors.push(assertion);
    } else if (kind === 'Warning' || kind === 'Skip') {
      attempt.assertionWarnings.push(assertion);
    }

    this.observeSessionMetadata(event);
  }

  private observeSessionMetadata(event: ReporterEvent) {
    const session = this.ensureSession(event);
    if (!session.startedAt) {
      session.startedAt = event.timestamp;
    }
    if (event.type === 'SessionFinished') {
      session.endedAt = event.timestamp;
    }
    if (session.coordinatorMode === 'Unknown' && event.coordinatorMode) {
      session.coordinatorMode = event.coordinatorMode;
    }
    appendUnique(session.effectiveCoordinatorModes, event.effectiveCoordinatorMode ?? event.coordinatorMode);
    for (const mode of getStringArrayField(event, 'modes')) {
      appendUnique(session.effectiveCoordinatorModes, mode);
    }
  }

  private ensureSession(event: ReporterEvent) {
    if (this.session?.sessionId !== event.sessionId) {
      this.session = {
        sessionId: event.sessionId,
        startedAt: event.timestamp,
        coordinatorMode: normalizeCoordinatorMode(event.coordinatorMode),
        effectiveCoordinatorModes: [],
        tests: new Map(),
        testsByEffectiveCoordinatorMode: new Map(),
      };
    }

    return this.session;
  }

  private tryGetTest(event: ReporterEvent) {
    const session = this.ensureSession(event);
    if (!event.testPath) {
      return undefined;
    }

    if (event.invocationIndex !== undefined) {
      return session.tests.get(makeTestKey(event.testPath, event.invocationIndex));
    }

    const locator = this.resolveExecutionLocator(event);
    if (locator) {
      return session.tests.get(locator.testKey);
    }

    return session.tests.get(makeTestKey(event.testPath, 0));
  }

  private ensureTest(event: ReporterEvent) {
    const session = this.ensureSession(event);
    const testPath = event.testPath ?? '<UnknownTest>';
    const invocationIndex = event.invocationIndex ?? this.tryGetTest(event)?.invocationIndex;
    const key = makeTestKey(testPath, invocationIndex);
    const matrixState = this.matrixStateByTestPath.get(testPath);

    let test = session.tests.get(key);
    if (!test) {
      test = {
        key,
        testId: event.testId,
        testPath,
        invocationIndex,
        coordinatorMode: normalizeCoordinatorMode(event.coordinatorMode ?? session.coordinatorMode),
        effectiveCoordinatorModes: [],
        phase: getStringField(event, 'phase') ?? 'Queued',
        currentRunIndex: getNumberField(event, 'currentRun') ?? 1,
        parameters: cloneBindings(event.parameters),
        metadata: cloneBindings(event.metadata),
        runs: [],
      };
      session.tests.set(key, test);
    }

    test.testId = event.testId ?? test.testId;
    test.invocationIndex = invocationIndex ?? test.invocationIndex;
    test.coordinatorMode = normalizeCoordinatorMode(event.coordinatorMode ?? test.coordinatorMode);
    test.phase = getStringField(event, 'phase') ?? test.phase;
    test.currentRunIndex = Math.max(test.currentRunIndex, getNumberField(event, 'currentRun') ?? test.currentRunIndex);
    if (test.parameters.length === 0) {
      test.parameters = cloneBindings(event.parameters);
    }
    if (test.metadata.length === 0) {
      test.metadata = cloneBindings(event.metadata);
    }

    appendUnique(test.effectiveCoordinatorModes, this.resolveEffectiveCoordinatorMode(event, test));
    if (matrixState) {
      for (const mode of matrixState.modes) {
        appendUnique(test.effectiveCoordinatorModes, mode);
      }
    }

    for (const mode of test.effectiveCoordinatorModes) {
      this.indexTestByEffectiveMode(mode, test);
    }

    return test;
  }

  private ensureRun(test: ATITest, runIndex: number) {
    const normalizedRunIndex = Math.max(1, runIndex);
    const existing = test.runs[normalizedRunIndex - 1];
    if (existing) {
      return existing;
    }

    const run: ATITestRun = {
      runIndex: normalizedRunIndex,
      status: normalizedRunIndex === test.currentRunIndex ? 'Running' : 'Queued',
      meta: {
        invocationIndex: test.invocationIndex,
        totalRuns: test.maxRuns,
      },
      executions: new Map(),
    };
    test.runs[normalizedRunIndex - 1] = run;
    return run;
  }

  private ensureExecutionForEvent(event: ReporterEvent) {
    const test = this.ensureTest(event);
    const run = this.ensureRun(test, this.resolveRunIndex(event, test));
    return this.ensureExecution(run, test, event);
  }

  private ensureExecution(run: ATITestRun, test: ATITest, event: ReporterEvent, preferredMode?: string) {
    const effectiveCoordinatorMode = preferredMode ?? this.resolveEffectiveCoordinatorMode(event, test);
    let execution = run.executions.get(effectiveCoordinatorMode);
    if (!execution) {
      execution = {
        effectiveCoordinatorMode,
        coordinatorMode: event.coordinatorMode,
        travelSessionId: event.travelSessionId,
        testId: event.testId,
        phase: test.phase,
        currentVariant: getNumberField(event, 'currentVariant'),
        totalVariants: getNumberField(event, 'totalVariants'),
        plans: new Map(),
      };
      run.executions.set(effectiveCoordinatorMode, execution);
    }

    execution.coordinatorMode = event.coordinatorMode ?? execution.coordinatorMode;
    execution.travelSessionId = event.travelSessionId ?? execution.travelSessionId;
    execution.testId = event.testId ?? execution.testId;
    execution.phase = getStringField(event, 'phase') ?? execution.phase;
    execution.currentVariant = getNumberField(event, 'currentVariant') ?? execution.currentVariant;
    execution.totalVariants = getNumberField(event, 'totalVariants') ?? execution.totalVariants;
    this.indexExecutionIdentifiers(test.key, run.runIndex, effectiveCoordinatorMode, event);
    return execution;
  }

  private ensurePlan(execution: ATITestExecution, planName: string) {
    let plan = execution.plans.get(planName);
    if (!plan) {
      plan = {
        planName,
        status: 'Queued',
        tasks: new Map(),
      };
      execution.plans.set(planName, plan);
    }
    return plan;
  }

  private ensureTaskForEvent(event: ReporterEvent) {
    const planName = getStringField(event, 'planName');
    const taskName = getStringField(event, 'taskName');
    if (!planName || !taskName) {
      throw new Error(`ATI task event '${event.type}' is missing planName or taskName`);
    }

    const execution = this.ensureExecutionForEvent(event);
    const plan = this.ensurePlan(execution, planName);
    let task = plan.tasks.get(taskName);
    if (!task) {
      task = {
        taskName,
        attempts: [],
      };
      plan.tasks.set(taskName, task);
    }
    return task;
  }

  private ensureAttempt(task: ATITask, attemptNumber: number, sourceClientIndex?: number) {
    const existing = task.attempts.find(
      (attempt) => attempt.attempt === attemptNumber && attempt.sourceClientIndex === sourceClientIndex,
    );
    if (existing) {
      return existing;
    }

    const created: ATITaskAttempt = {
      attempt: attemptNumber,
      assertionErrors: [],
      assertionWarnings: [],
    };
    if (sourceClientIndex !== undefined) {
      created.sourceClientIndex = sourceClientIndex;
    }
    task.attempts.push(created);
    return created;
  }

  private resolveAttempt(
    task: ATITask,
    attemptNumber: number,
    sourceClientIndex: number | undefined,
    createIfMissing: boolean,
  ) {
    const match = task.attempts.find(
      (attempt) => attempt.attempt === attemptNumber && attempt.sourceClientIndex === sourceClientIndex,
    );
    if (match) {
      return match;
    }

    if (createIfMissing) {
      return this.ensureAttempt(task, attemptNumber, sourceClientIndex);
    }

    const latest = task.attempts.at(-1);
    if (!latest) {
      throw new Error(`Task '${task.taskName}' has no ATI attempts`);
    }
    return latest;
  }

  private resolveLatestAttempt(task: ATITask, sourceClientIndex: number | undefined, createIfMissing: boolean) {
    let latestMatching: ATITaskAttempt | undefined;
    for (let index = task.attempts.length - 1; index >= 0; index -= 1) {
      const attempt = task.attempts[index];
      if (attempt?.sourceClientIndex === sourceClientIndex) {
        latestMatching = attempt;
        break;
      }
    }
    const latest = latestMatching ?? task.attempts.at(-1);
    if (latest) {
      return latest;
    }

    if (createIfMissing) {
      return this.ensureAttempt(task, 1, sourceClientIndex);
    }

    throw new Error(`Task '${task.taskName}' has no ATI attempts`);
  }

  private resolveRunIndex(event: ReporterEvent, test: ATITest) {
    const currentRun = getNumberField(event, 'currentRun');
    if (currentRun !== undefined) {
      return Math.max(1, currentRun);
    }

    return this.currentRunIndexByTestKey.get(test.key) ?? Math.max(1, test.currentRunIndex || 1);
  }

  private resolveEffectiveCoordinatorMode(event: ReporterEvent, test?: ATITest) {
    const matrixState = event.testPath ? this.matrixStateByTestPath.get(event.testPath) : undefined;
    return normalizeCoordinatorMode(
      event.effectiveCoordinatorMode ??
        event.coordinatorMode ??
        matrixState?.effectiveCoordinatorMode ??
        test?.effectiveCoordinatorModes.at(-1) ??
        this.session?.coordinatorMode,
    );
  }

  private resolveExecutionLocator(event: ReporterEvent) {
    for (const identifier of [event.travelSessionId, event.testId]) {
      if (!identifier) {
        continue;
      }

      const locator = this.executionIndex.get(identifier);
      if (locator) {
        return locator;
      }
    }

    return undefined;
  }

  private indexExecutionIdentifiers(
    testKey: string,
    runIndex: number,
    effectiveCoordinatorMode: string,
    event: ReporterEvent,
  ) {
    const locator: ExecutionLocator = { testKey, runIndex, effectiveCoordinatorMode };
    for (const identifier of [event.travelSessionId, event.testId]) {
      if (identifier) {
        this.executionIndex.set(identifier, locator);
      }
    }
  }

  private indexTestByEffectiveMode(mode: string, test: ATITest) {
    if (!this.session) {
      return;
    }

    const branch = this.session.testsByEffectiveCoordinatorMode.get(mode) ?? new Map<string, ATITest>();
    branch.set(test.key, test);
    this.session.testsByEffectiveCoordinatorMode.set(mode, branch);
  }
}
