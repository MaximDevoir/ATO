import type { Argv } from 'yargs';
import type { UAPKGCommandLine } from '../UAPKGCommandLine.js';
import type { UAPKGCommandModule } from './contracts/UAPKGCommandModule.js';
import { AddCommandModule } from './modules/AddCommandModule.js';
import { ConfigCommandModule } from './modules/ConfigCommandModule.js';
import { InitCommandModule } from './modules/InitCommandModule.js';
import { InstallCommandModule } from './modules/InstallCommandModule.js';
import { PackCommandModule } from './modules/PackCommandModule.js';
import { ProjectGetNameCommandModule } from './modules/ProjectGetNameCommandModule.js';
import { UpdateCommandModule } from './modules/UpdateCommandModule.js';

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
