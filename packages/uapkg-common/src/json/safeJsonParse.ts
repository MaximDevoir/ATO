import { createParseErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

/**
 * Parse a JSON string without throwing.
 * Returns a `Result<T>` with a `PARSE_ERROR` diagnostic on failure.
 */
export function safeJsonParse<T = unknown>(raw: string, filePath?: string): Result<T> {
  try {
    const parsed = JSON.parse(raw) as T;
    return ok(parsed);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return fail([createParseErrorDiagnostic(reason, filePath)]);
  }
}
