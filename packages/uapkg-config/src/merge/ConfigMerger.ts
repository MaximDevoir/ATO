import {
  createConfigTypeMismatchDiagnostic,
  createConfigUnknownKeyDiagnostic,
  DiagnosticBag,
} from '@uapkg/diagnostics';
import type { ConfigLayer, ConfigResolvedResult } from '../contracts/ConfigTypes.js';

interface MergeContext {
  readonly source: string;
  readonly filePath?: string;
}

/**
 * Schema-aware config merger that tolerates malformed layer values.
 *
 * Wrong container types are ignored with diagnostics. Broad-type-compatible
 * values are preserved, even if they might fail narrower semantic checks later.
 */
export class ConfigMerger {
  public mergeLayers(layers: readonly ConfigLayer[]): ConfigResolvedResult {
    const bag = new DiagnosticBag();
    let merged: Record<string, unknown> = {};

    for (const layer of layers) {
      const context: MergeContext = { source: layer.source, filePath: layer.file };
      merged = this.mergeRoot(merged, layer.values, context, bag);
    }

    return { value: merged, diagnostics: bag.all() };
  }

  private mergeRoot(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
    context: MergeContext,
    bag: DiagnosticBag,
  ): Record<string, unknown> {
    const next = { ...base };

    for (const [key, value] of Object.entries(override)) {
      switch (key) {
        case 'registry':
        case 'git':
        case 'editor':
          this.assignPrimitive(next, key, value, 'string', context, bag);
          break;
        case 'registries':
          next.registries = this.mergeRegistries(this.asRecord(base.registries), value, context, bag);
          break;
        case 'exec':
          next.exec = this.mergeSimpleObject(
            this.asRecord(base.exec),
            value,
            { shell: 'string' },
            'exec',
            context,
            bag,
          );
          break;
        case 'cache':
          next.cache = this.mergeSimpleObject(
            this.asRecord(base.cache),
            value,
            { enabled: 'boolean' },
            'cache',
            context,
            bag,
          );
          break;
        case 'registryCache':
          next.registryCache = this.mergeSimpleObject(
            this.asRecord(base.registryCache),
            value,
            { ttlSeconds: 'number' },
            'registryCache',
            context,
            bag,
          );
          break;
        case 'network':
          next.network = this.mergeSimpleObject(
            this.asRecord(base.network),
            value,
            { retries: 'number', timeout: 'number', maxConcurrentDownloads: 'number' },
            'network',
            context,
            bag,
          );
          break;
        case 'install':
          next.install = this.mergeSimpleObject(
            this.asRecord(base.install),
            value,
            { postInstallPolicy: 'string' },
            'install',
            context,
            bag,
          );
          break;
        case 'term':
          next.term = this.mergeSimpleObject(
            this.asRecord(base.term),
            value,
            { quiet: 'boolean', verbose: 'boolean' },
            'term',
            context,
            bag,
          );
          break;
        default:
          bag.add(
            createConfigUnknownKeyDiagnostic({
              path: key,
              source: context.source,
              filePath: context.filePath,
            }),
          );
          break;
      }
    }

    return next;
  }

  private mergeRegistries(
    base: Record<string, unknown>,
    override: unknown,
    context: MergeContext,
    bag: DiagnosticBag,
  ): Record<string, unknown> {
    if (!this.isRecord(override)) {
      bag.add(
        createConfigTypeMismatchDiagnostic({
          path: 'registries',
          expectedType: 'object',
          actualType: this.describeType(override),
          source: context.source,
          filePath: context.filePath,
        }),
      );
      return base;
    }

    const next = { ...base };
    for (const [registryName, registryValue] of Object.entries(override)) {
      const baseEntry = this.asRecord(base[registryName]);
      next[registryName] = this.mergeRegistryEntry(
        baseEntry,
        registryValue,
        `registries.${registryName}`,
        context,
        bag,
      );
    }

    return next;
  }

  private mergeRegistryEntry(
    base: Record<string, unknown>,
    override: unknown,
    path: string,
    context: MergeContext,
    bag: DiagnosticBag,
  ): Record<string, unknown> {
    if (!this.isRecord(override)) {
      bag.add(
        createConfigTypeMismatchDiagnostic({
          path,
          expectedType: 'object',
          actualType: this.describeType(override),
          source: context.source,
          filePath: context.filePath,
        }),
      );
      return base;
    }

    const next = { ...base };
    for (const [key, value] of Object.entries(override)) {
      switch (key) {
        case 'url':
          this.assignPrimitive(next, key, value, 'string', context, bag, `${path}.url`);
          break;
        case 'ttlSeconds':
          this.assignPrimitive(next, key, value, 'number', context, bag, `${path}.ttlSeconds`);
          break;
        case 'postInstallPolicy':
          this.assignPrimitive(next, key, value, 'string', context, bag, `${path}.postInstallPolicy`);
          break;
        case 'ref':
          next.ref = this.mergeSimpleObject(
            this.asRecord(base.ref),
            value,
            { type: 'string', value: 'string' },
            `${path}.ref`,
            context,
            bag,
          );
          break;
        default:
          bag.add(
            createConfigUnknownKeyDiagnostic({
              path: `${path}.${key}`,
              source: context.source,
              filePath: context.filePath,
            }),
          );
          break;
      }
    }

    return next;
  }

  private mergeSimpleObject(
    base: Record<string, unknown>,
    override: unknown,
    shape: Record<string, 'string' | 'number' | 'boolean'>,
    path: string,
    context: MergeContext,
    bag: DiagnosticBag,
  ): Record<string, unknown> {
    if (!this.isRecord(override)) {
      bag.add(
        createConfigTypeMismatchDiagnostic({
          path,
          expectedType: 'object',
          actualType: this.describeType(override),
          source: context.source,
          filePath: context.filePath,
        }),
      );
      return base;
    }

    const next = { ...base };
    for (const [key, value] of Object.entries(override)) {
      const expected = shape[key];
      if (!expected) {
        bag.add(
          createConfigUnknownKeyDiagnostic({
            path: `${path}.${key}`,
            source: context.source,
            filePath: context.filePath,
          }),
        );
        continue;
      }

      this.assignPrimitive(next, key, value, expected, context, bag, `${path}.${key}`);
    }

    return next;
  }

  private assignPrimitive(
    target: Record<string, unknown>,
    key: string,
    value: unknown,
    expected: 'string' | 'number' | 'boolean',
    context: MergeContext,
    bag: DiagnosticBag,
    path = key,
  ): void {
    if (typeof value !== expected) {
      bag.add(
        createConfigTypeMismatchDiagnostic({
          path,
          expectedType: expected,
          actualType: this.describeType(value),
          source: context.source,
          filePath: context.filePath,
        }),
      );
      return;
    }

    target[key] = value;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private describeType(value: unknown): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }
}
