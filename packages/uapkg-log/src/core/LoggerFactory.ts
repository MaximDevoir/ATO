import type { LoggerOptions, LoggerStateResolver } from '../contracts/LoggerTypes';
import { LoggerInstance } from './LoggerInstance';
import { LogLevelPolicy } from './LogLevelPolicy';
import { WinstonLoggerAdapter } from './WinstonLoggerAdapter';

export class LoggerFactory {
  constructor(private readonly policy = new LogLevelPolicy()) {}

  create(options: LoggerOptions = {}, resolver?: LoggerStateResolver) {
    const level = this.policy.resolveEffectiveLevel({
      explicitVerbose: options.verbose,
      explicitQuiet: options.quiet,
      resolver,
    });

    return new LoggerInstance(new WinstonLoggerAdapter(), level, options.context);
  }
}
