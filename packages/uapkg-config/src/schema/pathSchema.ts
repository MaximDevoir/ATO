import { createParseErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { ZodTypeAny } from 'zod';
import { getConfigSchemaRuntime } from './runtime/ConfigSchemaRuntimeProvider.js';

const runtime = getConfigSchemaRuntime();

export function validateConfigPath(pathToProperty: string): Result<void> {
  if (runtime.isValidPath(pathToProperty)) {
    return ok(undefined);
  }

  return fail([createParseErrorDiagnostic(`Invalid config path: ${pathToProperty}`)]);
}

export function isValidConfigPath(pathToProperty: string) {
  return runtime.isValidPath(pathToProperty);
}

export function isLeafConfigPath(pathToProperty: string): boolean {
  return runtime.isLeafPath(pathToProperty);
}

export function getConfigSchemaAtPath(pathToProperty: string): ZodTypeAny | null {
  return runtime.getSchemaAtPath(pathToProperty);
}

export function getValueByPath(data: unknown, pathToProperty?: string): unknown {
  if (!pathToProperty) {
    return data;
  }

  const segments = pathToProperty.split('.');
  let current: unknown = data;

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  return current;
}

export function setValueByPath(target: Record<string, unknown>, pathToProperty: string, value: unknown) {
  const segments = pathToProperty.split('.');
  let current: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const child = current[segment];
    if (!isRecord(child)) {
      const next: Record<string, unknown> = {};
      current[segment] = next;
      current = next;
      continue;
    }

    current = child;
  }

  current[segments.at(-1) as string] = value;
}

export function deleteValueByPath(target: Record<string, unknown>, pathToProperty: string): boolean {
  const segments = pathToProperty.split('.');
  let current: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const child = current[segment];
    if (!isRecord(child)) {
      return false;
    }

    current = child;
  }

  const leaf = segments.at(-1) as string;
  if (!(leaf in current)) {
    return false;
  }

  delete current[leaf];
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
