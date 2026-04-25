import { createParseErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

/**
 * Path-aware parser for `uapkg config set` CLI values.
 *
 * CLI values are treated as scalars and parsed according to the target path.
 */
export class ConfigValueParser {
  public parse(pathToProperty: string, rawValue: string): Result<unknown> {
    if (this.isBooleanPath(pathToProperty)) {
      return this.parseBoolean(pathToProperty, rawValue);
    }

    if (this.isNumberPath(pathToProperty)) {
      return this.parseNumber(pathToProperty, rawValue);
    }

    if (this.isRegistryRefTypePath(pathToProperty)) {
      return this.parseEnum(pathToProperty, rawValue, ['branch', 'tag', 'rev']);
    }

    if (this.isPostInstallPolicyPath(pathToProperty)) {
      return this.parseEnum(pathToProperty, rawValue, ['allow', 'deny']);
    }

    return ok(rawValue);
  }

  private isBooleanPath(pathToProperty: string): boolean {
    return pathToProperty === 'cache.enabled' || pathToProperty === 'term.quiet' || pathToProperty === 'term.verbose';
  }

  private isNumberPath(pathToProperty: string): boolean {
    if (
      pathToProperty === 'registryCache.ttlSeconds' ||
      pathToProperty === 'network.retries' ||
      pathToProperty === 'network.timeout' ||
      pathToProperty === 'network.maxConcurrentDownloads'
    ) {
      return true;
    }

    const parts = pathToProperty.split('.');
    return parts.length === 3 && parts[0] === 'registries' && parts[2] === 'ttlSeconds';
  }

  private isRegistryRefTypePath(pathToProperty: string): boolean {
    const parts = pathToProperty.split('.');
    return parts.length === 4 && parts[0] === 'registries' && parts[2] === 'ref' && parts[3] === 'type';
  }

  private isPostInstallPolicyPath(pathToProperty: string): boolean {
    if (pathToProperty === 'install.postInstallPolicy') return true;
    const parts = pathToProperty.split('.');
    return parts.length === 3 && parts[0] === 'registries' && parts[2] === 'postInstallPolicy';
  }

  private parseBoolean(pathToProperty: string, rawValue: string): Result<boolean> {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true') return ok(true);
    if (normalized === 'false') return ok(false);
    return fail([createParseErrorDiagnostic(`Expected boolean for "${pathToProperty}", received "${rawValue}".`)]);
  }

  private parseNumber(pathToProperty: string, rawValue: string): Result<number> {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return fail([createParseErrorDiagnostic(`Expected number for "${pathToProperty}", received "${rawValue}".`)]);
    }
    return ok(parsed);
  }

  private parseEnum(pathToProperty: string, rawValue: string, values: readonly string[]): Result<string> {
    if (values.includes(rawValue)) return ok(rawValue);
    return fail([
      createParseErrorDiagnostic(
        `Invalid value "${rawValue}" for "${pathToProperty}". Expected one of: ${values.join(', ')}.`,
      ),
    ]);
  }
}
