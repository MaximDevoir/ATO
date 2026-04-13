/**
 * Deterministic JSON serialization with sorted keys (deep).
 *
 * Equivalent to `json-stable-stringify` but zero-dependency.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}
