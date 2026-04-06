import type { LogEngine, LogLevel } from '../contracts/LoggerTypes';

export class LoggerInstance {
  constructor(
    private readonly engine: LogEngine,
    private readonly level: LogLevel,
    private readonly context?: string,
  ) {}

  info(message: string) {
    if (this.shouldLog('info')) {
      this.engine.log('info', this.withContext(message));
    }
  }

  warn(message: string) {
    if (this.shouldLog('warn')) {
      this.engine.log('warn', this.withContext(message));
    }
  }

  error(message: string) {
    if (this.shouldLog('error')) {
      this.engine.log('error', this.withContext(message));
    }
  }

  debug(message: string) {
    if (this.shouldLog('debug')) {
      this.engine.log('debug', this.withContext(message));
    }
  }

  private withContext(message: string) {
    return this.context ? `[${this.context}] ${message}` : message;
  }

  private shouldLog(level: LogLevel) {
    return this.levelWeight(level) <= this.levelWeight(this.level);
  }

  private levelWeight(level: LogLevel) {
    const weights: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    return weights[level];
  }
}
