import type { UAPKGCommandLine } from '../cli/UAPKGCommandLine.js';
import { AddCommand } from '../commands/AddCommand.js';
import { ConfigCommand } from '../commands/ConfigCommand.js';
import { InitCommand } from '../commands/InitCommand.js';
import { InstallCommand } from '../commands/InstallCommand.js';
import { PackCommand } from '../commands/PackCommand.js';
import { ProjectGetNameCommand } from '../commands/ProjectGetNameCommand.js';
import { UpdateCommand } from '../commands/UpdateCommand.js';
import { TOMLLockfileRepository } from '../lockfile/LockfileRepository.js';
import { FileManifestRepository } from '../manifest/ManifestRepository.js';
import { NodeFileSystemService } from '../services/FileSystemService.js';
import { SimpleGitClient } from '../services/GitClient.js';
import { ProjectContextDetector } from '../services/ProjectContextDetector.js';
import { ConsoleReporter } from '../ui/ConsoleReporter.js';
import { InkPromptService } from '../ui/PromptService.js';

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
        return await new AddCommand(
          {
            cwd: commandLine.cwd,
            source: commandLine.source,
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
      case 'pack': {
        return await new PackCommand({
          cwd: commandLine.cwd,
          dryRun: commandLine.dryRun,
          allowMissingLfs: commandLine.allowMissingLfs,
          outFile: commandLine.outFile,
        }).execute();
      }
      case 'config': {
        return await new ConfigCommand({
          cwd: commandLine.cwd,
          action: commandLine.action,
          pathToProperty: commandLine.path,
          rawValue: commandLine.value,
          scope: commandLine.scope,
          output: commandLine.output,
          showOrigin: commandLine.showOrigin,
          trace: commandLine.trace,
        }).execute();
      }
      default:
        throw new Error('[uapkg] Unsupported command');
    }
  }
}
