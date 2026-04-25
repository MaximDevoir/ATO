import type { z } from 'zod';
import {
  type ConfigSchemaNodeKind,
  getConfigSchemaNodeKind,
  getObjectShape,
  getRecordValueSchema,
  unwrapConfigSchema,
} from './ConfigSchemaIntrospection.js';

export interface ResolvedConfigSchemaPath {
  readonly path: string;
  readonly schema: z.ZodTypeAny;
  readonly kind: ConfigSchemaNodeKind;
}

/**
 * Runtime schema navigation for config paths.
 *
 * This keeps path validation and schema lookup derived from the Zod schema,
 * avoiding duplicated hardcoded key maps.
 */
export class ConfigSchemaRuntime {
  private readonly root: z.ZodTypeAny;

  public constructor(rootSchema: z.ZodTypeAny) {
    this.root = unwrapConfigSchema(rootSchema);
  }

  public getRootSchema(): z.ZodTypeAny {
    return this.root;
  }

  public resolvePath(pathToProperty: string): ResolvedConfigSchemaPath | null {
    const segments = this.splitPath(pathToProperty);
    if (!segments) return null;

    let current = this.root;

    for (const segment of segments) {
      const kind = getConfigSchemaNodeKind(current);

      if (kind === 'object') {
        const shape = getObjectShape(current);
        const child = shape[segment];
        if (!child) return null;
        current = unwrapConfigSchema(child);
        continue;
      }

      if (kind === 'record') {
        const valueSchema = getRecordValueSchema(current);
        if (!valueSchema) return null;
        current = valueSchema;
        continue;
      }

      return null;
    }

    const schema = unwrapConfigSchema(current);
    return {
      path: pathToProperty,
      schema,
      kind: getConfigSchemaNodeKind(schema),
    };
  }

  public getSchemaAtPath(pathToProperty: string): z.ZodTypeAny | null {
    return this.resolvePath(pathToProperty)?.schema ?? null;
  }

  public isValidPath(pathToProperty: string): boolean {
    return this.resolvePath(pathToProperty) !== null;
  }

  public isLeafPath(pathToProperty: string): boolean {
    const resolved = this.resolvePath(pathToProperty);
    if (!resolved) return false;
    return resolved.kind !== 'object' && resolved.kind !== 'record';
  }

  private splitPath(pathToProperty: string): string[] | null {
    if (!pathToProperty || pathToProperty.trim().length === 0) {
      return null;
    }

    const segments = pathToProperty.split('.');
    if (segments.some((segment) => segment.trim().length === 0)) {
      return null;
    }

    return segments;
  }
}
