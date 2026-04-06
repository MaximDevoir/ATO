import type { Argv } from 'yargs';
import type { UAPKGCommandLine } from '../UAPKGCommandLine';
import type { UAPKGCommandModule } from './contracts/UAPKGCommandModule';
import { AddCommandModule } from './modules/AddCommandModule';
import { ConfigCommandModule } from './modules/ConfigCommandModule';
import { InitCommandModule } from './modules/InitCommandModule';
import { InstallCommandModule } from './modules/InstallCommandModule';
import { PackCommandModule } from './modules/PackCommandModule';
import { ProjectGetNameCommandModule } from './modules/ProjectGetNameCommandModule';
import { UpdateCommandModule } from './modules/UpdateCommandModule';

export class UAPKGParserRegistry {
  constructor(
    private readonly modules: UAPKGCommandModule[] = [
      new InitCommandModule(),
      new AddCommandModule(),
      new InstallCommandModule(),
      new UpdateCommandModule(),
      new PackCommandModule(),
      new ProjectGetNameCommandModule(),
      new ConfigCommandModule(),
    ],
  ) {}

  registerAll(parser: Argv, sink: { set: (commandLine: UAPKGCommandLine) => void }) {
    let next = parser;
    for (const module of this.modules) {
      next = module.register(next, sink);
    }

    return next;
  }
}
