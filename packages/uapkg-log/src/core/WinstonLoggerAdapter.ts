import { createLogger, format, transports } from 'winston';
import type { LogEngine, LogLevel } from '../contracts/LoggerTypes';

export class WinstonLoggerAdapter implements LogEngine {
  private readonly logger = createLogger({
    level: 'debug',
    format: format.combine(
      format.timestamp(),
      format.printf(({ message }) => `${message}`),
    ),
    transports: [new transports.Console()],
  });

  log(level: LogLevel, message: string) {
    this.logger.log(level, message);
  }
}
