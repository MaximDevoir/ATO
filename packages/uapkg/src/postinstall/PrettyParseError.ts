export class PrettyParseError extends Error {
  constructor(filePath: string, message: string, source: string, index: number) {
    const location = toLineAndColumn(source, index);
    const snippet = formatSnippet(source, location.line, location.column);
    super(`[uapkg] ${filePath}:${location.line}:${location.column} ${message}\n${snippet}`);
    this.name = 'PrettyParseError';
  }
}

function toLineAndColumn(source: string, index: number) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < Math.min(index, source.length); i += 1) {
    if (source[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function formatSnippet(source: string, line: number, column: number) {
  const lines = source.split(/\r?\n/);
  const lineText = lines[line - 1] ?? '';
  return `${lineText}\n${' '.repeat(Math.max(0, column - 1))}^`;
}
