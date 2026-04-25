import { createParseErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { ConfigSchemaNodeKind } from './ConfigSchemaIntrospection.js';
import type { ConfigSchemaRuntime } from './ConfigSchemaRuntime.js';

/**
 * Parses scalar CLI input (`uapkg config set ...`) using the schema node at
 * the requested path as the source of truth.
 */
export class ConfigCliValueParser {
  public constructor(private readonly runtime: ConfigSchemaRuntime) {}

  public parse(pathToProperty: string, rawValue: string): Result<unknown> {
    const resolved = this.runtime.resolvePath(pathToProperty);
    if (!resolved) {
      return fail([createParseErrorDiagnostic(`Invalid config path: ${pathToProperty}`)]);
    }

    if (resolved.kind === 'object' || resolved.kind === 'record') {
      return fail([
        createParseErrorDiagnostic(
          `config set only supports leaf properties. Use a concrete path like "${pathToProperty}.<field>".`,
        ),
      ]);
    }

    const coerced = this.coerce(pathToProperty, rawValue, resolved.kind);
    if (!coerced.ok) return coerced;

    const validation = resolved.schema.safeParse(coerced.value);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return fail([
        createParseErrorDiagnostic(
          issue
            ? `Invalid value "${rawValue}" for "${pathToProperty}": ${issue.message}.`
            : `Invalid value "${rawValue}" for "${pathToProperty}".`,
        ),
      ]);
    }

    return ok(validation.data);
  }

  private coerce(pathToProperty: string, rawValue: string, kind: Exclude<ConfigSchemaNodeKind, 'object' | 'record'>) {
    switch (kind) {
      case 'boolean':
        return this.coerceBoolean(pathToProperty, rawValue);
      case 'number':
        return this.coerceNumber(pathToProperty, rawValue);
      case 'string':
      case 'enum':
      case 'other':
      default:
        return ok(rawValue);
    }
  }

  private coerceBoolean(pathToProperty: string, rawValue: string): Result<boolean> {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true') return ok(true);
    if (normalized === 'false') return ok(false);

    return fail([createParseErrorDiagnostic(`Expected boolean for "${pathToProperty}", received "${rawValue}".`)]);
  }

  private coerceNumber(pathToProperty: string, rawValue: string): Result<number> {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return fail([createParseErrorDiagnostic(`Expected number for "${pathToProperty}", received "${rawValue}".`)]);
    }

    return ok(parsed);
  }
}
