import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class OutdatedCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink): Argv {
    return parser.command(
      'outdated',
      'Show declared dependencies whose installed version lags behind wanted/latest',
      (builder) =>
        builder.option('json', {
          type: 'boolean',
          default: false,
          describe: 'Emit a single JSON object on stdout',
        }),
      (argv) => {
        sink.set(
          this.factory.createOutdated({
            cwd: process.cwd(),
            outputFormat: argv.json === true ? 'json' : 'text',
          }),
        );
      },
    );
  }
}

