export interface Reporter {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class ConsoleReporter implements Reporter {
  info(message: string) {
    console.log(message);
  }

  warn(message: string) {
    console.warn(message);
  }

  error(message: string) {
    console.error(message);
  }
}
