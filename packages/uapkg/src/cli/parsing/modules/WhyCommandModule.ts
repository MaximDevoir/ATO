import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class WhyCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink): Argv {
    return parser.command(
      'why <package>',
      'Print every dependency path from a graph root to <package>',
      (builder) =>
        builder
          .positional('package', { type: 'string', demandOption: true, describe: 'Target package name' })
          .option('json', { type: 'boolean', default: false, describe: 'Emit JSON on stdout' }),
      (argv) => {
        sink.set(
          this.factory.createWhy(String(argv.package), {
            cwd: process.cwd(),
            outputFormat: argv.json ? 'json' : 'text',
          }),
        );
      },
    );
  }
}
