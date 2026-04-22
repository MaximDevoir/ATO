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
          })
          .option('dev', { type: 'boolean', default: false, describe: 'Add to devDependencies' })
          .option('registry', { type: 'string', describe: 'Registry name (defaults to config `registry`)' })
          .option('dry-run', { type: 'boolean', default: false, describe: 'Compute the plan but perform no IO' })
          .option('json', { type: 'boolean', default: false, describe: 'Emit JSON on stdout' }),
      (argv) => {
        sink.set(
          this.factory.createAdd(String(argv.source), {
            cwd: process.cwd(),
            force: argv.force === true,
            pin: argv.pin === true,
            harnessed: argv.harnessed === true,
            dev: argv.dev === true,
            registry: typeof argv.registry === 'string' ? argv.registry : undefined,
            dryRun: argv['dry-run'] === true,
            outputFormat: argv.json === true ? 'json' : 'text',
          }),
        );
      },
    );
  }
}
