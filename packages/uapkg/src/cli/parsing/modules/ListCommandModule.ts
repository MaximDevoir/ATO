import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class ListCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink): Argv {
    return parser.command(
      'list',
      'Show installed packages from the lockfile',
      (builder) =>
        builder
          .option('depth', { type: 'number', default: 0, describe: 'Max tree depth (0 = declared only)' })
          .option('json', { type: 'boolean', default: false, describe: 'Emit JSON on stdout' }),
      (argv) => {
        sink.set(
          this.factory.createList({
            cwd: process.cwd(),
            depth: typeof argv.depth === 'number' ? argv.depth : 0,
            outputFormat: argv.json === true ? 'json' : 'text',
          }),
        );
      },
    );
  }
}
