import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine.js';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule.js';

export class InstallCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'install',
      'Install dependency graph for current manifest',
      (builder) =>
        builder
          .option('force', {
            type: 'boolean',
            default: false,
            describe: 'Override safety policies (e.g. target dir exists without uapkg.json)',
          })
          .option('frozen', {
            type: 'boolean',
            default: false,
            describe: 'Use the existing uapkg.lock verbatim; do not re-resolve',
          })
          .option('dry-run', { type: 'boolean', default: false, describe: 'Compute the plan but perform no IO' })
          .option('json', { type: 'boolean', default: false, describe: 'Emit JSON on stdout' })
          .conflicts('force', 'frozen'),
      (argv) => {
        sink.set(
          this.factory.createInstall({
            cwd: process.cwd(),
            force: argv.force,
            frozen: argv.frozen,
            dryRun: argv['dry-run'],
            outputFormat: argv.json ? 'json' : 'text',
          }),
        );
      },
    );
  }
}
