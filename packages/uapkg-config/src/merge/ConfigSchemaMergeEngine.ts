import {
  createConfigTypeMismatchDiagnostic,
  createConfigUnknownKeyDiagnostic,
  DiagnosticBag,
} from '@uapkg/diagnostics';
import type { ZodTypeAny } from 'zod';
import type { ConfigLayer, ConfigResolvedResult } from '../contracts/ConfigTypes.js';
import {
  type ConfigSchemaNodeKind,
  describeValueType,
  getConfigSchemaNodeKind,
  getExpectedBroadType,
  getObjectShape,
  getRecordValueSchema,
  isRecordValue,
} from '../schema/runtime/ConfigSchemaIntrospection.js';

interface MergeContext {
  readonly source: string;
  readonly filePath?: string;
}

/**
 * Generic schema-driven config merge engine.
 *
 * - Object/record container mismatches are ignored with diagnostics.
 * - Primitive broad-type mismatches are ignored with diagnostics.
 * - Narrow rule violations (enum/min/etc) are preserved and diagnosed later by
 *   semantic validation.
 */
export class ConfigSchemaMergeEngine {
  public constructor(private readonly rootSchema: ZodTypeAny) {}

  public mergeLayers(layers: readonly ConfigLayer[]): ConfigResolvedResult {
    const bag = new DiagnosticBag();
    let merged: unknown = {};

    for (const layer of layers) {
      const context: MergeContext = { source: layer.source, filePath: layer.file };
      merged = this.mergeNode(this.rootSchema, merged, layer.values, context, bag, []);
    }

    return { value: isRecordValue(merged) ? merged : {}, diagnostics: bag.all() };
  }

  private mergeNode(
    schema: ZodTypeAny,
    baseValue: unknown,
    overrideValue: unknown,
    context: MergeContext,
    bag: DiagnosticBag,
    pathSegments: readonly string[],
  ): unknown {
    const kind = getConfigSchemaNodeKind(schema);

    if (kind === 'object') {
      return this.mergeObjectNode(schema, baseValue, overrideValue, context, bag, pathSegments);
    }

    if (kind === 'record') {
      return this.mergeRecordNode(schema, baseValue, overrideValue, context, bag, pathSegments);
    }

    return this.mergeScalarNode(kind, baseValue, overrideValue, context, bag, pathSegments);
  }

  private mergeObjectNode(
    schema: ZodTypeAny,
    baseValue: unknown,
    overrideValue: unknown,
    context: MergeContext,
    bag: DiagnosticBag,
    pathSegments: readonly string[],
  ): Record<string, unknown> {
    const base = this.asRecord(baseValue);
    if (!isRecordValue(overrideValue)) {
      this.addTypeMismatch(bag, pathSegments, 'object', overrideValue, context);
      return base;
    }

    const shape = getObjectShape(schema);
    const next: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(overrideValue)) {
      const childSchema = shape[key];
      if (!childSchema) {
        bag.add(
          createConfigUnknownKeyDiagnostic({
            path: this.pathOf([...pathSegments, key]),
            source: context.source,
            filePath: context.filePath,
          }),
        );
        continue;
      }

      next[key] = this.mergeNode(childSchema, base[key], value, context, bag, [...pathSegments, key]);
    }

    return next;
  }

  private mergeRecordNode(
    schema: ZodTypeAny,
    baseValue: unknown,
    overrideValue: unknown,
    context: MergeContext,
    bag: DiagnosticBag,
    pathSegments: readonly string[],
  ): Record<string, unknown> {
    const base = this.asRecord(baseValue);
    if (!isRecordValue(overrideValue)) {
      this.addTypeMismatch(bag, pathSegments, 'object', overrideValue, context);
      return base;
    }

    const valueSchema = getRecordValueSchema(schema);
    if (!valueSchema) {
      return base;
    }

    const next: Record<string, unknown> = { ...base };
    for (const [dynamicKey, value] of Object.entries(overrideValue)) {
      next[dynamicKey] = this.mergeNode(valueSchema, base[dynamicKey], value, context, bag, [
        ...pathSegments,
        dynamicKey,
      ]);
    }

    return next;
  }

  private mergeScalarNode(
    kind: Exclude<ConfigSchemaNodeKind, 'object' | 'record'>,
    baseValue: unknown,
    overrideValue: unknown,
    context: MergeContext,
    bag: DiagnosticBag,
    pathSegments: readonly string[],
  ): unknown {
    const expected = getExpectedBroadType(kind);

    if (kind === 'other') {
      return overrideValue;
    }

    if (!this.isBroadTypeCompatible(expected, overrideValue)) {
      this.addTypeMismatch(bag, pathSegments, expected, overrideValue, context);
      return baseValue;
    }

    return overrideValue;
  }

  private isBroadTypeCompatible(expected: string, value: unknown): boolean {
    if (expected === 'object') {
      return isRecordValue(value);
    }

    return typeof value === expected;
  }

  private addTypeMismatch(
    bag: DiagnosticBag,
    pathSegments: readonly string[],
    expectedType: string,
    actualValue: unknown,
    context: MergeContext,
  ): void {
    bag.add(
      createConfigTypeMismatchDiagnostic({
        path: this.pathOf(pathSegments),
        expectedType,
        actualType: describeValueType(actualValue),
        source: context.source,
        filePath: context.filePath,
      }),
    );
  }

  private pathOf(pathSegments: readonly string[]): string {
    if (pathSegments.length === 0) return '$';
    return pathSegments.join('.');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return isRecordValue(value) ? value : {};
  }
}
