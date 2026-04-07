import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class AddCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'add <source>',
      'Add dependency source to current uapkg.json',
      (builder) =>
        builder
          .positional('source', {
            type: 'string',
            describe: 'Dependency source specifier',
            demandOption: true,
          })
          .option('force', {
            type: 'boolean',
            default: false,
            describe: 'Override safety policy for local drift/branch divergence',
          })
          .option('pin', {
            type: 'boolean',
            default: false,
            describe: 'Add/replace project override for this dependency',
          })
          .option('harnessed', {
            type: 'boolean',
            default: false,
            describe: 'Mark dependency as harnessed (tracked in lockfile, but protected during updates)',
          }),
      (argv) => {
        sink.set(
          this.factory.createAdd(String(argv.source), {
            cwd: process.cwd(),
            force: argv.force === true,
            pin: argv.pin === true,
            harnessed: argv.harnessed === true,
          }),
        );
      },
    );
  }
}
