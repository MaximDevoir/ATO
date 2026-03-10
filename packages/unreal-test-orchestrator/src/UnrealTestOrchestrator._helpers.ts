import * as fs from 'node:fs';
export function checkExistsSync(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
