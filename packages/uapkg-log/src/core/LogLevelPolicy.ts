import type { LoggerStateResolver, LogLevel } from '../contracts/LoggerTypes';

export class LogLevelPolicy {
  resolveLevel(options: { verbose: boolean; quiet: boolean }): LogLevel {
    if (options.verbose) {
      return 'debug';
    }

    if (options.quiet) {
      return 'error';
    }

    return 'info';
  }

  resolveEffectiveLevel(options: {
    explicitVerbose?: boolean;
    explicitQuiet?: boolean;
    resolver?: LoggerStateResolver;
  }): LogLevel {
    const verbose = options.explicitVerbose ?? options.resolver?.isVerboseEnabled() ?? false;
    const quiet = options.explicitQuiet ?? options.resolver?.isQuietEnabled() ?? false;

    return this.resolveLevel({ verbose, quiet });
  }
}
