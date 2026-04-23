import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class RemoveCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink): Argv {
    return parser.command(
      'remove <package>',
      'Remove a dependency from uapkg.json and reconcile the install tree',
      (builder) =>
        builder
          .positional('package', { type: 'string', demandOption: true, describe: 'Package name to remove' })
          .option('json', { type: 'boolean', default: false, describe: 'Emit JSON on stdout' }),
      (argv) => {
        sink.set(
          this.factory.createRemove(String(argv.package), {
            cwd: process.cwd(),
            outputFormat: argv.json ? 'json' : 'text',
          }),
        );
      },
    );
  }
}
