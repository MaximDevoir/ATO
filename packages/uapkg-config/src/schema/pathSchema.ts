import { createParseErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

const directPaths = new Set([
  'registry',
  'registries',
  'git',
  'editor',
  'exec',
  'exec.shell',
  'cache',
  'cache.enabled',
  'registryCache',
  'registryCache.ttlSeconds',
  'network',
  'network.retries',
  'network.timeout',
  'term',
  'term.quiet',
  'term.verbose',
]);

export function validateConfigPath(pathToProperty: string): Result<void> {
  if (isValidConfigPath(pathToProperty)) {
    return ok(undefined);
  }

  return fail([createParseErrorDiagnostic(`Invalid config path: ${pathToProperty}`)]);
}

export function isValidConfigPath(pathToProperty: string) {
  if (!pathToProperty.trim()) {
    return false;
  }

  if (directPaths.has(pathToProperty)) {
    return true;
  }

  const segments = pathToProperty.split('.');
  if (segments[0] !== 'registries') {
    return false;
  }

  if (segments.length < 2 || segments[1].trim().length === 0) {
    return false;
  }

  if (segments.length === 2) {
    return true;
  }

  if (segments.length === 3 && segments[2] === 'url') {
    return true;
  }

  if (segments.length === 3 && segments[2] === 'ref') {
    return true;
  }

  if (segments.length === 4 && segments[2] === 'ref' && (segments[3] === 'type' || segments[3] === 'value')) {
    return true;
  }

  if (segments.length === 3 && segments[2] === 'ttlSeconds') {
    return true;
  }

  return false;
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
