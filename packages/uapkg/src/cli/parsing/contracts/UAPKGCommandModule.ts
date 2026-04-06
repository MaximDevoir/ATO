import type { Argv } from 'yargs';
import type { UAPKGCommandLine } from '../../UAPKGCommandLine';

export interface CommandLineSink {
  set(commandLine: UAPKGCommandLine): void;
}

export interface UAPKGCommandModule {
  register(parser: Argv, sink: CommandLineSink): Argv;
}
