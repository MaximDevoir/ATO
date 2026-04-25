import { z } from 'zod';

export type ConfigSchemaNodeKind = 'object' | 'record' | 'string' | 'number' | 'boolean' | 'enum' | 'other';

export type ConfigObjectShape = Record<string, z.ZodTypeAny>;

export function unwrapConfigSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault ||
      current instanceof z.ZodCatch ||
      current instanceof z.ZodReadonly
    ) {
      current = current.unwrap() as unknown as z.ZodTypeAny;
      continue;
    }

    if (current instanceof z.ZodPipe) {
      current = current.def.in as unknown as z.ZodTypeAny;
      continue;
    }

    return current;
  }
}

export function getConfigSchemaNodeKind(schema: z.ZodTypeAny): ConfigSchemaNodeKind {
  const node = unwrapConfigSchema(schema);

  if (node instanceof z.ZodObject) return 'object';
  if (node instanceof z.ZodRecord) return 'record';
  if (node instanceof z.ZodString) return 'string';
  if (node instanceof z.ZodNumber) return 'number';
  if (node instanceof z.ZodBoolean) return 'boolean';
  if (node instanceof z.ZodEnum) return 'enum';

  return 'other';
}

export function getObjectShape(schema: z.ZodTypeAny): ConfigObjectShape {
  const node = unwrapConfigSchema(schema);
  if (!(node instanceof z.ZodObject)) {
    return {};
  }

  return (node.shape as ConfigObjectShape) ?? {};
}

export function getRecordValueSchema(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const node = unwrapConfigSchema(schema);
  if (!(node instanceof z.ZodRecord)) {
    return null;
  }

  return unwrapConfigSchema(node.valueType as z.ZodTypeAny);
}

export function getExpectedBroadType(kind: ConfigSchemaNodeKind): string {
  switch (kind) {
    case 'object':
    case 'record':
      return 'object';
    case 'string':
    case 'enum':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'value';
  }
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describeValueType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}
