import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dynamicSnapshotKeys = new Set([
  'sessionId',
  'testId',
  'travelSessionId',
  'sequence',
  'timestamp',
  'startedAt',
  'endedAt',
  'startTime',
  'endTime',
  'finishedAt',
  'durationSeconds',
  'startedSequence',
  'completedSequence',
]);

export interface FileSnapshotOptions {
  updateSnapshot?: boolean;
  relativeTo?: string | URL;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Map);
}

function shouldSanitizeSourceLocationKey(owner: Record<string, unknown>, key: string) {
  if (!('message' in owner)) {
    return false;
  }

  return key === 'file' || key === 'line' || key === 'sourceFile' || key === 'sourceLine' || key === 'sourceFunction';
}

function sanitizeDynamicValue(key: string, value: unknown, owner?: Record<string, unknown>) {
  if (!dynamicSnapshotKeys.has(key)) {
    if (!owner || !shouldSanitizeSourceLocationKey(owner, key)) {
      return value;
    }
  }

  return `<dynamic:${key}>`;
}

export function normalizeSnapshotValue(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()]
        .sort(([left], [right]) => String(left).localeCompare(String(right)))
        .map(([key, nestedValue]) => [String(key), normalizeSnapshotValue(nestedValue)]),
    );
  }

  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => {
      const normalizedEntry = normalizeSnapshotValue(value[index]);
      return normalizedEntry === undefined ? null : normalizedEntry;
    });
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([key, nestedValue]) => [key, normalizeSnapshotValue(sanitizeDynamicValue(key, nestedValue, value))] as const,
        )
        .filter(([, nestedValue]) => nestedValue !== undefined),
    );
  }

  return value;
}

function resolveSnapshotAbsolutePath(snapshotPath: string, relativeTo?: string | URL) {
  if (path.isAbsolute(snapshotPath)) {
    return snapshotPath;
  }

  if (!relativeTo) {
    return path.resolve(snapshotPath);
  }

  if (relativeTo instanceof URL) {
    return path.resolve(path.dirname(fileURLToPath(relativeTo)), snapshotPath);
  }

  if (relativeTo.startsWith('file://')) {
    return path.resolve(path.dirname(fileURLToPath(relativeTo)), snapshotPath);
  }

  return path.resolve(path.dirname(relativeTo), snapshotPath);
}

function resolveActualSnapshotPath(snapshotAbsolutePath: string) {
  return snapshotAbsolutePath.endsWith('.json')
    ? snapshotAbsolutePath.replace(/\.json$/i, '.actual.json')
    : `${snapshotAbsolutePath}.actual.json`;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function matchFileSnapshot(value: unknown, snapshotPath: string, options: FileSnapshotOptions = {}) {
  const snapshotAbsolutePath = resolveSnapshotAbsolutePath(snapshotPath, options.relativeTo);
  const actualSnapshotPath = resolveActualSnapshotPath(snapshotAbsolutePath);
  const normalizedValue = normalizeSnapshotValue(value);

  if (options.updateSnapshot) {
    await writeJsonFile(snapshotAbsolutePath, normalizedValue);
    await rm(actualSnapshotPath, { force: true });
    return normalizedValue;
  }

  let expectedValue: unknown;
  try {
    expectedValue = JSON.parse(await readFile(snapshotAbsolutePath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      await writeJsonFile(actualSnapshotPath, normalizedValue);
      throw new Error(
        `Snapshot file '${snapshotAbsolutePath}' does not exist. Wrote current value to '${actualSnapshotPath}'. Re-run with --updateSnapshots to create it.`,
      );
    }

    throw error;
  }

  try {
    assert.deepStrictEqual(normalizedValue, expectedValue);
    await rm(actualSnapshotPath, { force: true });
  } catch (error) {
    await writeJsonFile(actualSnapshotPath, normalizedValue);
    const diffMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Snapshot mismatch for '${snapshotAbsolutePath}'. Current value written to '${actualSnapshotPath}'.\n${diffMessage}`,
    );
  }

  return normalizedValue;
}
