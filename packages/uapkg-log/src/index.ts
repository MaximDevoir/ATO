import type { Logger, LoggerOptions, LoggerStateResolver } from './contracts/LoggerTypes';
import { LoggerFactory } from './core/LoggerFactory';

const defaultResolver: LoggerStateResolver = {
  isVerboseEnabled: () => false,
  isQuietEnabled: () => false,
};

class GlobalLogger implements Logger {
  private readonly factory = new LoggerFactory();
  private resolver: LoggerStateResolver = defaultResolver;

  configureResolver(resolver: LoggerStateResolver) {
    this.resolver = resolver;
  }

  create(options: LoggerOptions = {}) {
    return this.factory.create(options, this.resolver);
  }

  info(message: string) {
    this.create().info(message);
  }

  warn(message: string) {
    this.create().warn(message);
  }

  error(message: string) {
    this.create().error(message);
  }

  debug(message: string) {
    this.create().debug(message);
  }
}

const singleton = new GlobalLogger();

export function configureLogger(resolver: LoggerStateResolver) {
  singleton.configureResolver(resolver);
}

export function createLogger(options: LoggerOptions = {}) {
  return singleton.create(options);
}

const Log: Logger = {
  info(message) {
    singleton.info(message);
  },
  warn(message) {
    singleton.warn(message);
  },
  error(message) {
    singleton.error(message);
  },
  debug(message) {
    singleton.debug(message);
  },
};

export default Log;
export type { Logger, LoggerOptions, LoggerStateResolver } from './contracts/LoggerTypes';
