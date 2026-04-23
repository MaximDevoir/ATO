import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class InitCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'init',
      'Initialize uapkg.json',
      (builder) =>
        builder
          .option('type', {
            type: 'string',
            choices: ['project', 'plugin'] as const,
            describe: 'Explicit manifest type for init',
          })
          .option('name', {
            type: 'string',
            describe: 'Explicit package name for init',
          }),
      (argv) => {
        sink.set(
          this.factory.createInit({
            cwd: process.cwd(),
            type: argv.type,
            name: typeof argv.name === 'string' ? argv.name : undefined,
          }),
        );
      },
    );
  }
}
