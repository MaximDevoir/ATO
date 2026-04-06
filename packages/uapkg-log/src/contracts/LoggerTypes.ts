export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface LoggerOptions {
  context?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export interface LoggerStateResolver {
  isVerboseEnabled(): boolean;
  isQuietEnabled(): boolean;
}

export interface LogEngine {
  log(level: LogLevel, message: string): void;
}
