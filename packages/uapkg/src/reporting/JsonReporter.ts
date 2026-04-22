import type { Diagnostic } from '@uapkg/diagnostics';
import { ProcessTextSink, type TextSink } from './TextSink.js';

/**
 * Stable JSON envelope used when any command is invoked with `--json`.
 *
 * `status` is `ok` / `error` so scripts can branch on exit-independent
 * outcomes. `diagnostics` always appears (empty array when none), so
 * consumers never need to handle undefined.
 */
export interface JsonEnvelope<TData = unknown> {
  readonly status: 'ok' | 'error';
  readonly command: string;
  readonly data?: TData;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Writes a single JSON document to stdout per invocation. Never writes
 * progress or partial output — callers accumulate everything into a payload
 * and call `emit()` once at the end of a command.
 */
export class JsonReporter {
  public constructor(private readonly sink: TextSink = new ProcessTextSink(process.stdout)) {}

  public emit<TData>(envelope: JsonEnvelope<TData>): void {
    this.sink.writeLine(JSON.stringify(envelope, null, 2));
  }
}

