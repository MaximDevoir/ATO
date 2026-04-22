import type { Diagnostic } from '@uapkg/diagnostics';

/**
 * Minimal stdout writer abstraction so reporters can be driven by tests.
 */
export interface TextSink {
  writeLine(line: string): void;
  write(text: string): void;
}

/** Default sink → `process.stdout` / `process.stderr`. */
export class ProcessTextSink implements TextSink {
  public constructor(private readonly stream: NodeJS.WritableStream = process.stdout) {}

  public writeLine(line: string): void {
    this.stream.write(`${line}\n`);
  }

  public write(text: string): void {
    this.stream.write(text);
  }
}

/**
 * Sorts diagnostics by severity so humans see errors first.
 */
export const DIAGNOSTIC_LEVEL_ORDER: Readonly<Record<Diagnostic['level'], number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (a, b) => DIAGNOSTIC_LEVEL_ORDER[a.level] - DIAGNOSTIC_LEVEL_ORDER[b.level],
  );
}

