/** Indent every line of `text` by `spaces` spaces. */
export function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

/** Format an array of items as a bulleted list. */
export function bulletList(items: readonly string[], bullet = '- '): string {
  return items.map((item) => `${bullet}${item}`).join('\n');
}
