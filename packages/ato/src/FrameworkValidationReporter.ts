import type { ATISimpleReporter } from '@maximdevoir/ati';
import { matchFileSnapshot } from './FileSnapshot.js';

export type FrameworkValidationCoordinatorLabel = 'DEDICATED' | 'LISTEN' | 'STANDALONE' | 'PIE' | 'SERVER';
export type FrameworkValidationTestResult = 'Success' | 'Fail' | 'Error' | 'NotRun' | 'Unknown';

export interface FrameworkValidationSnapshotInit {
  simpleReporter?: ATISimpleReporter;
  updateSnapshots?: boolean;
  snapshotRelativeTo?: string | URL;
}

export interface FrameworkValidationCoordinatorLogSource {
  type: 'Coordinator';
  coordinator: FrameworkValidationCoordinatorLabel;
  label: string;
}

export interface FrameworkValidationClientLogSource {
  type: 'Client';
  clientIndex: number;
  label: string;
}

export type FrameworkValidationLogSource = FrameworkValidationCoordinatorLogSource | FrameworkValidationClientLogSource;

export interface FrameworkValidationLogEntry {
  sequence: number;
  line: string;
  source: FrameworkValidationLogSource;
}

export interface FrameworkValidationEventEntry {
  sequence: number;
  category: string;
  line: string;
  fields: Record<string, string>;
  source: FrameworkValidationLogSource;
}

export interface FrameworkValidationTestRun {
  sequence: number;
  ordinal: number;
  path: string;
  name: string;
  pathName: string;
  coordinator: FrameworkValidationCoordinatorLabel;
  result?: FrameworkValidationTestResult;
  completed: boolean;
  startedSequence: number;
  completedSequence?: number;
  logs: FrameworkValidationLogEntry[];
  events: FrameworkValidationEventEntry[];
}

export interface FrameworkValidationReport {
  enabled: boolean;
  tests: FrameworkValidationTestRun[];
  issues: string[];
  totalObservedEntries: number;
}

export interface FrameworkValidationStartedTest {
  coordinator: FrameworkValidationCoordinatorLabel;
  path: string;
  name: string;
}

export interface FrameworkValidationCompletedTest extends FrameworkValidationStartedTest {
  result: FrameworkValidationTestResult;
}

export interface FrameworkValidationCoordinatorLogExpectation {
  type: 'Coordinator';
  coordinator?: FrameworkValidationCoordinatorLabel;
  logContains: string;
}

export interface FrameworkValidationClientLogExpectation {
  type: 'Client';
  clientIndex: number;
  logContains: string;
}

export type FrameworkValidationLogExpectation =
  | FrameworkValidationCoordinatorLogExpectation
  | FrameworkValidationClientLogExpectation;

export interface FrameworkValidationEventExpectation {
  category: string;
  source?:
    | {
        type: 'Coordinator';
        coordinator?: FrameworkValidationCoordinatorLabel;
      }
    | {
        type: 'Client';
        clientIndex: number;
      };
  fields?: Record<string, string | number | boolean>;
  fieldContains?: Record<string, string>;
}

const frameworkValidationStartedPattern =
  /LogAutomationController:\s+(?:Display|Error):\s+Test Started\.\s+Name=\{([^}]*)}\s+Path=\{([^}]*)}/i;
const frameworkValidationCompletedPattern =
  /LogAutomationController:\s+(?:Display|Error):\s+Test Completed\.\s+Result=\{([^}]*)}\s+Name=\{([^}]*)}\s+Path=\{([^}]*)}/i;
const frameworkValidationEventPattern = /(ATC_EVENT_[A-Z0-9_]+):\s+(?:Display|Warning|Error):\s*(.*)$/i;
const frameworkValidationClientLabelPattern = /^CLIENT\s+(\d+)$/i;
const frameworkValidationTokens = ['ATC_INTERNAL_TESTS', 'ATC_EVENT_'] as const;

export function composeFrameworkValidationPathName(path: string, name: string) {
  return `${path.trim()}${name.trim()}`;
}

function toFrameworkValidationTestResult(rawResult: string): FrameworkValidationTestResult {
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

export function parseFrameworkValidationLogSource(label: string): FrameworkValidationLogSource | undefined {
  const normalized = label.trim().toUpperCase();
  switch (normalized) {
    case 'DEDICATED':
    case 'LISTEN':
    case 'STANDALONE':
    case 'PIE':
    case 'SERVER':
      return {
        type: 'Coordinator',
        coordinator: normalized,
        label,
      };
  }

  const clientMatch = frameworkValidationClientLabelPattern.exec(label.trim());
  if (!clientMatch) {
    return undefined;
  }

  return {
    type: 'Client',
    clientIndex: Number.parseInt(clientMatch[1] ?? '', 10),
    label,
  };
}

export function parseFrameworkValidationStartedTest(
  line: string,
): Omit<FrameworkValidationStartedTest, 'coordinator'> | undefined {
  const match = frameworkValidationStartedPattern.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    name: (match[1] ?? '').trim(),
    path: (match[2] ?? '').trim(),
  };
}

export function parseFrameworkValidationCompletedTest(
  line: string,
): Omit<FrameworkValidationCompletedTest, 'coordinator'> | undefined {
  const match = frameworkValidationCompletedPattern.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    result: toFrameworkValidationTestResult(match[1] ?? ''),
    name: (match[2] ?? '').trim(),
    path: (match[3] ?? '').trim(),
  };
}

export function shouldCaptureFrameworkValidationLine(line: string) {
  return frameworkValidationTokens.some((token) => line.includes(token));
}

function unescapeFrameworkValidationFieldValue(value: string) {
  return value.replaceAll(/\\([\\"nrt])/g, (_, esc: string) => {
    switch (esc) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '"':
        return '"';
      default:
        return '\\';
    }
  });
}

export function parseFrameworkValidationEventFields(payload: string) {
  const fields: Record<string, string> = {};
  let index = 0;
  while (index < payload.length) {
    while (index < payload.length && /\s/.test(payload[index] ?? '')) {
      index += 1;
    }
    if (index >= payload.length) {
      break;
    }

    const equalsIndex = payload.indexOf('=', index);
    if (equalsIndex <= index) {
      break;
    }

    const key = payload.slice(index, equalsIndex).trim();
    index = equalsIndex + 1;
    if (!key) {
      break;
    }

    let value = '';
    if ((payload[index] ?? '') === '"') {
      index += 1;
      let escaped = false;
      while (index < payload.length) {
        const character = payload[index] ?? '';
        index += 1;
        if (escaped) {
          value += `\\${character}`;
          escaped = false;
          continue;
        }
        if (character === '\\') {
          escaped = true;
          continue;
        }
        if (character === '"') {
          break;
        }
        value += character;
      }
      fields[key] = unescapeFrameworkValidationFieldValue(value);
      continue;
    }

    const nextWhitespaceIndex = payload.slice(index).search(/\s/);
    const endIndex = nextWhitespaceIndex === -1 ? payload.length : index + nextWhitespaceIndex;
    value = payload.slice(index, endIndex);
    fields[key] = value;
    index = endIndex;
  }

  return fields;
}

export function parseFrameworkValidationEvent(line: string) {
  const match = frameworkValidationEventPattern.exec(line);
  if (!match) {
    return undefined;
  }

  return {
    category: (match[1] ?? '').trim(),
    fields: parseFrameworkValidationEventFields((match[2] ?? '').trim()),
  };
}

function cloneFrameworkValidationSource(source: FrameworkValidationLogSource): FrameworkValidationLogSource {
  if (source.type === 'Client') {
    return {
      type: 'Client',
      clientIndex: source.clientIndex,
      label: source.label,
    };
  }

  return {
    type: 'Coordinator',
    coordinator: source.coordinator,
    label: source.label,
  };
}

function cloneFrameworkValidationLogEntry(entry: FrameworkValidationLogEntry): FrameworkValidationLogEntry {
  return {
    sequence: entry.sequence,
    line: entry.line,
    source: cloneFrameworkValidationSource(entry.source),
  };
}

function cloneFrameworkValidationEventEntry(entry: FrameworkValidationEventEntry): FrameworkValidationEventEntry {
  return {
    sequence: entry.sequence,
    category: entry.category,
    line: entry.line,
    fields: { ...entry.fields },
    source: cloneFrameworkValidationSource(entry.source),
  };
}

function cloneFrameworkValidationTestRun(test: FrameworkValidationTestRun): FrameworkValidationTestRun {
  return {
    sequence: test.sequence,
    ordinal: test.ordinal,
    path: test.path,
    name: test.name,
    pathName: test.pathName,
    coordinator: test.coordinator,
    result: test.result,
    completed: test.completed,
    startedSequence: test.startedSequence,
    completedSequence: test.completedSequence,
    logs: test.logs.map(cloneFrameworkValidationLogEntry),
    events: test.events.map(cloneFrameworkValidationEventEntry),
  };
}

export class FrameworkValidationReporterController {
  private enabled = false;
  private sequence = 0;
  private activeTestIndex: number | undefined;
  private readonly issues: string[] = [];
  private readonly tests: FrameworkValidationTestRun[] = [];
  private readonly seenPathNameCounts = new Map<string, number>();

  enable() {
    this.enabled = true;
    return this;
  }

  disable() {
    this.enabled = false;
    return this;
  }

  isEnabled() {
    return this.enabled;
  }

  reset() {
    this.sequence = 0;
    this.activeTestIndex = undefined;
    this.issues.length = 0;
    this.tests.length = 0;
    this.seenPathNameCounts.clear();
    return this;
  }

  getReport(): FrameworkValidationReport {
    return {
      enabled: this.enabled,
      totalObservedEntries: this.sequence,
      issues: [...this.issues],
      tests: this.tests.map(cloneFrameworkValidationTestRun),
    };
  }

  observeProcessLine(label: string, line: string) {
    if (!this.enabled) {
      return;
    }

    try {
      this.applyObservedProcessLine(label, line);
    } catch (error) {
      this.recordIssue(error instanceof Error ? error.message : String(error));
    }
  }

  startTest(startedTest: FrameworkValidationStartedTest) {
    if (this.activeTestIndex !== undefined) {
      const activeTest = this.tests[this.activeTestIndex];
      throw new Error(
        `FrameworkValidationReporter.startTest() called while test '${activeTest?.pathName ?? '<unknown>'}' is still active`,
      );
    }

    const path = startedTest.path.trim();
    const name = startedTest.name.trim();
    const pathName = composeFrameworkValidationPathName(path, name);
    const ordinal = (this.seenPathNameCounts.get(pathName) ?? 0) + 1;
    this.seenPathNameCounts.set(pathName, ordinal);

    const test: FrameworkValidationTestRun = {
      sequence: this.tests.length + 1,
      ordinal,
      path,
      name,
      pathName,
      coordinator: startedTest.coordinator,
      completed: false,
      startedSequence: this.nextSequence(),
      logs: [],
      events: [],
    };

    this.tests.push(test);
    this.activeTestIndex = this.tests.length - 1;
    return cloneFrameworkValidationTestRun(test);
  }

  endTest(completedTest: FrameworkValidationCompletedTest) {
    if (this.activeTestIndex === undefined) {
      throw new Error(
        `FrameworkValidationReporter.endTest() called for '${composeFrameworkValidationPathName(completedTest.path, completedTest.name)}' while no test is active`,
      );
    }

    const activeTest = this.tests[this.activeTestIndex];
    if (!activeTest) {
      throw new Error('FrameworkValidationReporter lost track of the active test state');
    }

    if (activeTest.coordinator !== completedTest.coordinator) {
      this.recordIssue(
        `FrameworkValidationReporter.endTest() completed '${composeFrameworkValidationPathName(completedTest.path, completedTest.name)}' from '${completedTest.coordinator}', but the active test started on '${activeTest.coordinator}'`,
      );
    }

    if (activeTest.path !== completedTest.path || activeTest.name !== completedTest.name) {
      this.recordIssue(
        `FrameworkValidationReporter.endTest() completed '${composeFrameworkValidationPathName(completedTest.path, completedTest.name)}', but the active test is '${activeTest.pathName}'`,
      );
    }

    activeTest.result = completedTest.result;
    activeTest.completed = true;
    activeTest.completedSequence = this.nextSequence();
    this.activeTestIndex = undefined;
    return cloneFrameworkValidationTestRun(activeTest);
  }

  addLog(source: FrameworkValidationLogSource, line: string) {
    if (this.activeTestIndex === undefined) {
      return undefined;
    }

    const activeTest = this.tests[this.activeTestIndex];
    if (!activeTest) {
      return undefined;
    }

    const entry: FrameworkValidationLogEntry = {
      sequence: this.nextSequence(),
      line,
      source: cloneFrameworkValidationSource(source),
    };
    activeTest.logs.push(entry);
    return cloneFrameworkValidationLogEntry(entry);
  }

  addEvent(source: FrameworkValidationLogSource, category: string, line: string, fields: Record<string, string>) {
    if (this.activeTestIndex === undefined) {
      return undefined;
    }

    const activeTest = this.tests[this.activeTestIndex];
    if (!activeTest) {
      return undefined;
    }

    const entry: FrameworkValidationEventEntry = {
      sequence: this.nextSequence(),
      category,
      line,
      fields: { ...fields },
      source: cloneFrameworkValidationSource(source),
    };
    activeTest.events.push(entry);
    return cloneFrameworkValidationEventEntry(entry);
  }

  private applyObservedProcessLine(label: string, line: string) {
    const source = parseFrameworkValidationLogSource(label);
    if (!source) {
      return;
    }

    if (source.type === 'Coordinator') {
      const startedTest = parseFrameworkValidationStartedTest(line);
      if (startedTest) {
        this.startTest({
          coordinator: source.coordinator,
          ...startedTest,
        });
        return;
      }

      const completedTest = parseFrameworkValidationCompletedTest(line);
      if (completedTest) {
        this.endTest({
          coordinator: source.coordinator,
          ...completedTest,
        });
        return;
      }
    }

    if (!shouldCaptureFrameworkValidationLine(line)) {
      return;
    }

    const parsedEvent = parseFrameworkValidationEvent(line);
    if (parsedEvent) {
      this.addEvent(source, parsedEvent.category, line, parsedEvent.fields);
    }

    this.addLog(source, line);
  }

  private nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  private recordIssue(message: string) {
    this.issues.push(message);
  }
}

export const FrameworkValidationReporter = new FrameworkValidationReporterController();

function formatExpectation(expectation: FrameworkValidationLogExpectation) {
  if (expectation.type === 'Client') {
    return `Client ${expectation.clientIndex} containing '${expectation.logContains}'`;
  }

  const coordinatorSuffix = expectation.coordinator ? ` (${expectation.coordinator})` : '';
  return `Coordinator${coordinatorSuffix} containing '${expectation.logContains}'`;
}

function formatEventExpectation(expectation: FrameworkValidationEventExpectation) {
  const sourceDescription = expectation.source
    ? expectation.source.type === 'Client'
      ? ` from Client ${expectation.source.clientIndex}`
      : ` from Coordinator${expectation.source.coordinator ? ` (${expectation.source.coordinator})` : ''}`
    : '';
  return `${expectation.category}${sourceDescription}`;
}

function matchesFrameworkValidationExpectation(
  entry: FrameworkValidationLogEntry,
  expectation: FrameworkValidationLogExpectation,
) {
  if (expectation.type === 'Client') {
    return (
      entry.source.type === 'Client' &&
      entry.source.clientIndex === expectation.clientIndex &&
      entry.line.includes(expectation.logContains)
    );
  }

  return (
    entry.source.type === 'Coordinator' &&
    (expectation.coordinator === undefined || entry.source.coordinator === expectation.coordinator) &&
    entry.line.includes(expectation.logContains)
  );
}

function matchesFrameworkValidationEventExpectation(
  entry: FrameworkValidationEventEntry,
  expectation: FrameworkValidationEventExpectation,
) {
  if (entry.category !== expectation.category) {
    return false;
  }

  if (expectation.source) {
    if (expectation.source.type === 'Client') {
      if (entry.source.type !== 'Client' || entry.source.clientIndex !== expectation.source.clientIndex) {
        return false;
      }
    } else if (
      entry.source.type !== 'Coordinator' ||
      (expectation.source.coordinator !== undefined && entry.source.coordinator !== expectation.source.coordinator)
    ) {
      return false;
    }
  }

  for (const [key, expectedValue] of Object.entries(expectation.fields ?? {})) {
    if ((entry.fields[key] ?? '') !== String(expectedValue)) {
      return false;
    }
  }

  for (const [key, expectedValue] of Object.entries(expectation.fieldContains ?? {})) {
    if (!(entry.fields[key] ?? '').includes(expectedValue)) {
      return false;
    }
  }

  return true;
}

export class FrameworkValidationTest {
  private nextSequenceCursor = 0;

  constructor(private readonly testRun: FrameworkValidationTestRun) {}

  get data() {
    return cloneFrameworkValidationTestRun(this.testRun);
  }

  get logs() {
    return this.testRun.logs.map(cloneFrameworkValidationLogEntry);
  }

  get events() {
    return this.testRun.events.map(cloneFrameworkValidationEventEntry);
  }

  resetCursor() {
    this.nextSequenceCursor = 0;
    return this;
  }

  expectResult(expected: FrameworkValidationTestResult) {
    if (this.testRun.result !== expected) {
      throw new Error(
        `Expected test '${this.testRun.pathName}' run ${this.testRun.ordinal} to finish with '${expected}', but got '${this.testRun.result ?? 'undefined'}'`,
      );
    }
    return this;
  }

  expectNextLog(expectation: FrameworkValidationLogExpectation) {
    for (const entry of this.testRun.logs) {
      if (entry.sequence <= this.nextSequenceCursor) {
        continue;
      }
      if (!matchesFrameworkValidationExpectation(entry, expectation)) {
        continue;
      }

      this.nextSequenceCursor = entry.sequence;
      return cloneFrameworkValidationLogEntry(entry);
    }

    throw new Error(
      `Unable to find the next framework validation log for ${formatExpectation(expectation)} in '${this.testRun.pathName}' run ${this.testRun.ordinal}`,
    );
  }

  expectNextParallelLogs(expectations: readonly FrameworkValidationLogExpectation[]) {
    if (expectations.length === 0) {
      return [];
    }

    const matches = new Map<number, FrameworkValidationLogEntry>();
    let furthestSequence = -1;
    for (const entry of this.testRun.logs) {
      if (entry.sequence <= this.nextSequenceCursor) {
        continue;
      }

      for (let expectationIndex = 0; expectationIndex < expectations.length; expectationIndex += 1) {
        if (matches.has(expectationIndex)) {
          continue;
        }

        const expectation = expectations[expectationIndex];
        if (!expectation || !matchesFrameworkValidationExpectation(entry, expectation)) {
          continue;
        }

        matches.set(expectationIndex, entry);
        furthestSequence = Math.max(furthestSequence, entry.sequence);
        break;
      }

      if (matches.size === expectations.length) {
        this.nextSequenceCursor = furthestSequence;
        return expectations.map((_, expectationIndex) => {
          const match = matches.get(expectationIndex);
          if (!match) {
            throw new Error('Parallel log match bookkeeping became inconsistent');
          }
          return cloneFrameworkValidationLogEntry(match);
        });
      }
    }

    const missingExpectations = expectations
      .filter((_, expectationIndex) => !matches.has(expectationIndex))
      .map((expectation) => formatExpectation(expectation));
    throw new Error(
      `Unable to satisfy framework validation parallel logs in '${this.testRun.pathName}' run ${this.testRun.ordinal}; missing ${missingExpectations.join(', ')}`,
    );
  }

  expectNextEvent(expectation: FrameworkValidationEventExpectation) {
    for (const entry of this.testRun.events) {
      if (entry.sequence <= this.nextSequenceCursor) {
        continue;
      }
      if (!matchesFrameworkValidationEventExpectation(entry, expectation)) {
        continue;
      }

      this.nextSequenceCursor = entry.sequence;
      return cloneFrameworkValidationEventEntry(entry);
    }

    throw new Error(
      `Unable to find the next framework validation event for ${formatEventExpectation(expectation)} in '${this.testRun.pathName}' run ${this.testRun.ordinal}`,
    );
  }

  expectNextParallelEvents(expectations: readonly FrameworkValidationEventExpectation[]) {
    if (expectations.length === 0) {
      return [];
    }

    const matches = new Map<number, FrameworkValidationEventEntry>();
    let furthestSequence = -1;
    for (const entry of this.testRun.events) {
      if (entry.sequence <= this.nextSequenceCursor) {
        continue;
      }

      for (let expectationIndex = 0; expectationIndex < expectations.length; expectationIndex += 1) {
        if (matches.has(expectationIndex)) {
          continue;
        }

        const expectation = expectations[expectationIndex];
        if (!expectation || !matchesFrameworkValidationEventExpectation(entry, expectation)) {
          continue;
        }

        matches.set(expectationIndex, entry);
        furthestSequence = Math.max(furthestSequence, entry.sequence);
        break;
      }

      if (matches.size === expectations.length) {
        this.nextSequenceCursor = furthestSequence;
        return expectations.map((_, expectationIndex) => {
          const match = matches.get(expectationIndex);
          if (!match) {
            throw new Error('Parallel event match bookkeeping became inconsistent');
          }
          return cloneFrameworkValidationEventEntry(match);
        });
      }
    }

    const missingExpectations = expectations
      .filter((_, expectationIndex) => !matches.has(expectationIndex))
      .map((expectation) => formatEventExpectation(expectation));
    throw new Error(
      `Unable to satisfy framework validation parallel events in '${this.testRun.pathName}' run ${this.testRun.ordinal}; missing ${missingExpectations.join(', ')}`,
    );
  }
}

export class FrameworkValidationSnapshotSubject {
  constructor(
    private readonly value: unknown,
    private readonly updateSnapshots: boolean,
    private readonly snapshotRelativeTo?: string | URL,
  ) {}

  get data() {
    return this.value;
  }

  async toMatchFileSnapshot(snapshotPath: string, relativeTo?: string | URL) {
    await matchFileSnapshot(this.value, snapshotPath, {
      updateSnapshot: this.updateSnapshots,
      relativeTo: relativeTo ?? this.snapshotRelativeTo,
    });
    return this;
  }
}

export class FrameworkValidation {
  constructor(
    private readonly report: FrameworkValidationReport,
    private readonly snapshotInit: FrameworkValidationSnapshotInit = {},
  ) {}

  get issues() {
    return [...this.report.issues];
  }

  get tests() {
    return this.report.tests.map((test) => new FrameworkValidationTest(cloneFrameworkValidationTestRun(test)));
  }

  assertNoIssues() {
    if (this.report.issues.length === 0) {
      return this;
    }

    throw new Error(`Framework validation reported issues:\n- ${this.report.issues.join('\n- ')}`);
  }

  getTestsByPath(path: string) {
    return this.report.tests
      .filter((test) => test.path === path)
      .map((test) => new FrameworkValidationTest(cloneFrameworkValidationTestRun(test)));
  }

  getTestsByPathName(pathName: string) {
    return this.report.tests
      .filter((test) => test.pathName === pathName)
      .map((test) => new FrameworkValidationTest(cloneFrameworkValidationTestRun(test)));
  }

  getTestByPath(path: string, ordinal = 1) {
    return this.getSingleTest(
      this.report.tests.filter((test) => test.path === path),
      `path '${path}'`,
      ordinal,
    );
  }

  getTestByPathName(pathName: string, ordinal = 1) {
    return this.getSingleTest(
      this.report.tests.filter((test) => test.pathName === pathName),
      `pathName '${pathName}'`,
      ordinal,
    );
  }

  getBySimpleReporterPath(path: readonly (string | number)[]) {
    if (!this.snapshotInit.simpleReporter) {
      throw new Error('FrameworkValidation does not have an ATISimpleReporter attached for snapshot traversal');
    }

    return new FrameworkValidationSnapshotSubject(
      this.snapshotInit.simpleReporter.getBySimpleReporterPath(path),
      this.snapshotInit.updateSnapshots === true,
      this.snapshotInit.snapshotRelativeTo,
    );
  }

  private getSingleTest(tests: FrameworkValidationTestRun[], description: string, ordinal: number) {
    const matchedTest = tests.find((test) => test.ordinal === ordinal);
    if (!matchedTest) {
      const knownOrdinals = tests.map((test) => test.ordinal).join(', ');
      const knownOrdinalsSuffix = knownOrdinals ? ` (known ordinals: ${knownOrdinals})` : '';
      throw new Error(
        `Unable to find framework validation test for ${description} with ordinal ${ordinal}${knownOrdinalsSuffix}`,
      );
    }

    return new FrameworkValidationTest(cloneFrameworkValidationTestRun(matchedTest));
  }
}

export function formatFrameworkValidationSummaryLines(report: FrameworkValidationReport) {
  if (!report.enabled) {
    return [] as string[];
  }

  const lines = [
    'Framework Validation',
    `Tracked ${report.tests.length} automation test(s) with ${report.tests.reduce((count, test) => count + test.logs.length, 0)} captured log(s) and ${report.tests.reduce((count, test) => count + test.events.length, 0)} captured event(s)`,
  ];

  for (const test of report.tests) {
    const ordinalSuffix = test.ordinal > 1 ? ` #${test.ordinal}` : '';
    const status = test.result ?? (test.completed ? 'Unknown' : 'InProgress');
    lines.push(
      `${test.coordinator} | ${status} | ${test.path}${ordinalSuffix} | logs=${test.logs.length} | events=${test.events.length}`,
    );
  }

  if (report.issues.length > 0) {
    lines.push(`Issues (${report.issues.length})`);
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines;
}
