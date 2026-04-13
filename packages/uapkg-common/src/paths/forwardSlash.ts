/**
 * Normalize a file path to use forward slashes on all platforms.
 */
export function toForwardSlash(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Remove `.` and `..` segments and normalize separators.
 * This is a pure string operation — it does **not** access the file system.
 */
export function normalizePath(filePath: string): string {
  const parts = toForwardSlash(filePath).split('/');
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}
