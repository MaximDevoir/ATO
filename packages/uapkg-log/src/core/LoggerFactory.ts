import type { LoggerOptions, LoggerStateResolver } from '../contracts/LoggerTypes.js';
import { LoggerInstance } from './LoggerInstance.js';
import { LogLevelPolicy } from './LogLevelPolicy.js';
import { WinstonLoggerAdapter } from './WinstonLoggerAdapter.js';

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
