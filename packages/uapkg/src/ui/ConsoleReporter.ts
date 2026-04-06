import { createLogger } from '@uapkg/log';

export interface Reporter {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class ConsoleReporter implements Reporter {
  private readonly logger = createLogger();

  info(message: string) {
    this.logger.info(message);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  error(message: string) {
    this.logger.error(message);
  }
}
