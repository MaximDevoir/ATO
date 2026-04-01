import * as fs from 'node:fs';

export function checkExistsSync(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}
