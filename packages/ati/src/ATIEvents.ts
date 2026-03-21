export type ATCCoordinatorMode = 'Dedicated' | 'ListenServer' | 'Standalone' | 'PIE' | 'Unknown';

export type ATCParticipantKind = 'Coordinator' | 'LocalPlayer' | 'ExternalClient';

export type ATCTaskTarget = 'Coordinator' | 'LocalPlayer' | 'SingleExternalClient' | 'AllExternalClients';

export type ATCTestPhase =
  | 'Queued'
  | 'Traveling'
  | 'WaitingForParticipants'
  | 'SetupWorld'
  | 'RunningPlans'
  | 'TeardownWorld'
  | 'Completed';

export type ATCRepeatMode = 'None' | 'Count' | 'UntilFail';

export type ATCMessageKind = 'FatalError' | 'NonFatalError' | 'Warning' | 'Skip';

export type ATCParameterBinding = {
  name: string;
  value: string;
};

export type ATCEventType =
  | 'TestStarted'
  | 'TestPhaseChanged'
  | 'TestFinished'
  | 'PlanStarted'
  | 'PlanFinished'
  | 'TaskDispatched'
  | 'TaskStarted'
  | 'TaskResult'
  | 'TaskRetry'
  | 'TaskTimeout'
  | 'Message'
  | 'TestRepeat'
  | 'CoordinatorMatrix'
  | 'ClientConnected'
  | 'ClientReady';

export type ATCEventBase = {
  version: 1;
  sessionId: string;
  sequence: number;
  timestamp: number;
  type: string;
  testId?: string;
  testPath?: string;
  travelSessionId?: string;
  coordinatorMode?: ATCCoordinatorMode | string;
  effectiveCoordinatorMode?: ATCCoordinatorMode | string;
  processRole?: 'Coordinator' | string;
  invocationIndex?: number;
  requiredClients?: number;
  parameters?: ATCParameterBinding[];
  metadata?: ATCParameterBinding[];
};

export type ATCTestStartedEvent = ATCEventBase & {
  type: 'TestStarted';
  testPath: string;
  invocationIndex: number;
  requiredClients: number;
};

export type ATCTestPhaseChangedEvent = ATCEventBase & {
  type: 'TestPhaseChanged';
  testPath: string;
  phase: ATCTestPhase | string;
};

export type ATCTestFinishedEvent = ATCEventBase & {
  type: 'TestFinished';
  testPath: string;
  success: boolean;
  skipped: boolean;
  durationSeconds: number;
  message: string;
  skipRunsRequested?: number;
  skipAllRemainingRuns?: boolean;
  messageCount?: number;
};

export type ATCPlanStartedEvent = ATCEventBase & {
  type: 'PlanStarted';
  testPath?: string;
  planName: string;
};

export type ATCPlanFinishedEvent = ATCEventBase & {
  type: 'PlanFinished';
  testPath?: string;
  planName: string;
  success: boolean;
  failedTasks?: string;
  completedTasks?: number;
  skippedTasks?: number;
  reason?: string;
  message?: string;
};

export type ATCTaskDispatchedEvent = ATCEventBase & {
  type: 'TaskDispatched';
  testPath?: string;
  planName: string;
  taskName: string;
  taskTarget: ATCTaskTarget | string;
  taskRole?: string;
  targetClientIndex?: number;
  attempt?: number;
  maxRetries?: number;
  retryDelaySeconds?: number;
  taskTimeoutSeconds?: number;
};

export type ATCTaskStartedEvent = ATCEventBase & {
  type: 'TaskStarted';
  testPath?: string;
  planName: string;
  taskName: string;
  attempt?: number;
  sourceClientIndex?: number;
  taskTarget?: ATCTaskTarget | string;
};

export type ATCTaskResultEvent = ATCEventBase & {
  type: 'TaskResult';
  testPath?: string;
  planName: string;
  taskName: string;
  status?: string;
  success: boolean;
  skipped: boolean;
  durationSeconds?: number;
  attempt?: number;
  maxRetries?: number;
  sourceClientIndex?: number;
  testSkipRequested?: boolean;
  messageCount?: number;
  message?: string;
};

export type ATCTaskRetryEvent = ATCEventBase & {
  type: 'TaskRetry';
  testPath?: string;
  planName: string;
  taskName: string;
  state: 'Scheduled' | 'Executing' | string;
  attempt?: number;
  failedAttempt?: number;
  nextAttempt?: number;
  retriesRemaining?: number;
  maxRetries?: number;
  delaySeconds?: number;
  message?: string;
};

export type ATCTaskTimeoutEvent = ATCEventBase & {
  type: 'TaskTimeout';
  testPath?: string;
  planName: string;
  taskName: string;
  timeoutType?: string;
  message?: string;
  timeoutSeconds?: number;
};

export type ATCMessageEvent = ATCEventBase & {
  type: 'Message';
  kind: ATCMessageKind | string;
  message: string;
  planName?: string;
  taskName?: string;
  sourceClientIndex?: number;
  sourceFile?: string;
  sourceLine?: number;
  sourceFunction?: string;
};

export type ATCTestRepeatEvent = ATCEventBase & {
  type: 'TestRepeat';
  testPath: string;
  state: 'RunStart' | 'RunEnd' | 'RunsSkipped' | 'Complete' | string;
  repeatMode?: ATCRepeatMode | string;
  currentRun?: number;
  totalRuns?: number;
  completedRuns?: number;
  executedRuns?: number;
  skippedRuns?: number;
  afterRun?: number;
  nextRun?: number;
  failed?: boolean;
  skipped?: boolean;
  stopReason?: string;
};

export type ATCCoordinatorMatrixEvent = ATCEventBase & {
  type: 'CoordinatorMatrix';
  testPath: string;
  state: 'Modes' | 'VariantStart' | 'VariantEnd' | string;
  modes?: string[];
  currentVariant?: number;
  totalVariants?: number;
  success?: boolean;
};

export type ATCClientConnectedEvent = ATCEventBase & {
  type: 'ClientConnected';
  testPath?: string;
  participantKind?: ATCParticipantKind | string;
  clientIndex?: number;
  participantName?: string;
  connectedClients?: number;
};

export type ATCClientReadyEvent = ATCEventBase & {
  type: 'ClientReady';
  testPath?: string;
  participantKind?: ATCParticipantKind | string;
  clientIndex?: number;
  readyClients?: number;
  requiredClients?: number;
};

export type ATCKnownEvent =
  | ATCTestStartedEvent
  | ATCTestPhaseChangedEvent
  | ATCTestFinishedEvent
  | ATCPlanStartedEvent
  | ATCPlanFinishedEvent
  | ATCTaskDispatchedEvent
  | ATCTaskStartedEvent
  | ATCTaskResultEvent
  | ATCTaskRetryEvent
  | ATCTaskTimeoutEvent
  | ATCMessageEvent
  | ATCTestRepeatEvent
  | ATCCoordinatorMatrixEvent
  | ATCClientConnectedEvent
  | ATCClientReadyEvent;

export type ATCForwardCompatibleEvent = ATCEventBase & {
  type: string;
  [key: string]: unknown;
};

export type ATCEvent = ATCKnownEvent | ATCForwardCompatibleEvent;

export const knownATCEventTypes = new Set<ATCEventType>([
  'TestStarted',
  'TestPhaseChanged',
  'TestFinished',
  'PlanStarted',
  'PlanFinished',
  'TaskDispatched',
  'TaskStarted',
  'TaskResult',
  'TaskRetry',
  'TaskTimeout',
  'Message',
  'TestRepeat',
  'CoordinatorMatrix',
  'ClientConnected',
  'ClientReady',
]);

export function isKnownATCEventType(type: string): type is ATCEventType {
  return knownATCEventTypes.has(type as ATCEventType);
}
