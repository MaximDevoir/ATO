import { createHash } from 'node:crypto';
import type { DiagnosticLevel } from './DiagnosticLevel.js';

interface FingerprintInput {
  readonly level: DiagnosticLevel;
  readonly code: string;
  readonly message: string;
  readonly hint?: string;
  readonly data: unknown;
}

export function createDiagnosticFingerprint(input: FingerprintInput): string {
  const serialized = stableSerialize({
    level: input.level,
    code: input.code,
    message: input.message,
    hint: input.hint ?? null,
    data: input.data ?? null,
  });

  return createHash('sha256').update(serialized).digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const body = entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',');
  return `{${body}}`;
}
