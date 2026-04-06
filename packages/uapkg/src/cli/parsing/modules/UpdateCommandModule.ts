import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule';

export class UpdateCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'update',
      'Update dependency graph and lockfile from remote refs',
      (builder) =>
        builder.option('force', {
          type: 'boolean',
          default: false,
          describe: 'Override safety policy for local drift/branch divergence',
        }),
      (argv) => {
        sink.set(
          this.factory.createUpdate({
            cwd: process.cwd(),
            force: argv.force === true,
          }),
        );
      },
    );
  }
}
