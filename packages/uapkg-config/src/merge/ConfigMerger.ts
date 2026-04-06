export class ConfigMerger {
  merge(base: unknown, override: unknown): unknown {
    if (Array.isArray(base) && Array.isArray(override)) {
      return override;
    }

    if (this.isRecord(base) && this.isRecord(override)) {
      const result: Record<string, unknown> = { ...base };
      for (const [key, value] of Object.entries(override)) {
        if (key in result) {
          result[key] = this.merge(result[key], value);
        } else {
          result[key] = value;
        }
      }

      return result;
    }

    return override;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
