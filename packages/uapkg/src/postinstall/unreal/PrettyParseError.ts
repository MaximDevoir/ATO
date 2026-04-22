/**
 * Structured parse failure for C# build files. Emitted as the `reason` payload
 * of `POSTINSTALL_LOAD_FAILED`-adjacent diagnostics by injector callers.
 *
 * Unlike the legacy version this class is still a standard `Error` subclass so
 * it composes cleanly with `try/catch`, but the new postinstall subsystem never
 * lets it escape — injectors catch and convert to diagnostics.
 */
export class PrettyParseError extends Error {
  public readonly filePath: string;
  public readonly line: number;
  public readonly column: number;

  public constructor(filePath: string, message: string, source: string, index: number) {
    const { line, column } = toLineAndColumn(source, index);
    const snippet = formatSnippet(source, line, column);
    super(`${filePath}:${line}:${column} ${message}\n${snippet}`);
    this.name = 'PrettyParseError';
    this.filePath = filePath;
    this.line = line;
    this.column = column;
  }
}

function toLineAndColumn(source: string, index: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const limit = Math.min(index, source.length);
  for (let i = 0; i < limit; i += 1) {
    if (source[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function formatSnippet(source: string, line: number, column: number): string {
  const lines = source.split(/\r?\n/);
  const lineText = lines[line - 1] ?? '';
  return `${lineText}\n${' '.repeat(Math.max(0, column - 1))}^`;
}

