import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule';

export class ProjectGetNameCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'project get name',
      'Get current project name from uapkg.json when manifest type is project',
      (builder) => builder,
      () => {
        sink.set(
          this.factory.createProjectGetName({
            cwd: process.cwd(),
          }),
        );
      },
    );
  }
}
