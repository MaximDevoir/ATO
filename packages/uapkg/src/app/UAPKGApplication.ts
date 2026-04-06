import type { UAPKGCommandLine } from '../cli/UAPKGCommandLine';
import { AddCommand } from '../commands/AddCommand';
import { ConfigCommand } from '../commands/ConfigCommand';
import { InitCommand } from '../commands/InitCommand';
import { InstallCommand } from '../commands/InstallCommand';
import { ProjectGetNameCommand } from '../commands/ProjectGetNameCommand';
import { UpdateCommand } from '../commands/UpdateCommand';
import { TOMLLockfileRepository } from '../lockfile/LockfileRepository';
import { FileManifestRepository } from '../manifest/ManifestRepository';
import { NodeFileSystemService } from '../services/FileSystemService';
import { SimpleGitClient } from '../services/GitClient';
import { ProjectContextDetector } from '../services/ProjectContextDetector';
import { ConsoleReporter } from '../ui/ConsoleReporter';
import { InkPromptService } from '../ui/PromptService';

export class UAPKGApplication {
  async run(commandLine: UAPKGCommandLine) {
    const manifestRepository = new FileManifestRepository();
    const lockfileRepository = new TOMLLockfileRepository();
    const fileSystem = new NodeFileSystemService();
    const gitClient = new SimpleGitClient();
    const reporter = new ConsoleReporter();

    switch (commandLine.command) {
      case 'init': {
        return await new InitCommand(
          {
            cwd: commandLine.cwd,
            explicitType: commandLine.type,
            explicitName: commandLine.name,
          },
          manifestRepository,
          new ProjectContextDetector(),
          new InkPromptService(),
          reporter,
        ).execute();
      }
      case 'add': {
        const source = commandLine.args[0];
        if (!source) {
          throw new Error('[uapkg] add requires dependency source argument');
        }

        return await new AddCommand(
          {
            cwd: commandLine.cwd,
            source,
            force: commandLine.force,
            pin: commandLine.pin,
            harnessed: commandLine.harnessed,
          },
          manifestRepository,
          lockfileRepository,
          fileSystem,
          gitClient,
          reporter,
        ).execute();
      }
      case 'install': {
        return await new InstallCommand(
          { cwd: commandLine.cwd, force: commandLine.force },
          manifestRepository,
          lockfileRepository,
          fileSystem,
          gitClient,
          reporter,
        ).execute();
      }
      case 'update': {
        return await new UpdateCommand(
          { cwd: commandLine.cwd, force: commandLine.force },
          manifestRepository,
          lockfileRepository,
          fileSystem,
          gitClient,
          reporter,
        ).execute();
      }
      case 'project-get-name': {
        return await new ProjectGetNameCommand({ cwd: commandLine.cwd }, manifestRepository, reporter).execute();
      }
      case 'config': {
        return await new ConfigCommand({
          cwd: commandLine.cwd,
          action: commandLine.configAction,
          args: commandLine.args,
          global: commandLine.global,
          local: commandLine.local,
          json: commandLine.json,
          showOrigin: commandLine.showOrigin,
          trace: commandLine.trace,
        }).execute();
      }
      default:
        throw new Error(`[uapkg] Unsupported command: ${commandLine.command satisfies never}`);
    }
  }
}
