export class DependencySourceValidator {
  isSupported(source: string) {
    const trimmed = source.trim();
    return trimmed.startsWith('http') || trimmed.startsWith('git@') || trimmed.startsWith('file:');
  }

  assertSupported(source: string) {
    if (!this.isSupported(source)) {
      throw new Error(`[uapm] Unsupported dependency source: ${source}. Supported: http*, git@*, file:*`);
    }
  }
}
