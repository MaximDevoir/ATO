import path from 'node:path';

export class PathUtils {
  normalizeForComparison(rawPath: string) {
    const normalized = path.resolve(rawPath).replaceAll('\\', '/');
    if (process.platform === 'win32') {
      return normalized.toLowerCase();
    }

    return normalized;
  }

  isSamePath(left: string, right: string) {
    return this.normalizeForComparison(left) === this.normalizeForComparison(right);
  }
}
