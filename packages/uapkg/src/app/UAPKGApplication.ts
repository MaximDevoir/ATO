import type { UAPKGCommandLine } from '../cli/UAPKGCommandLine.js';
import { AddCommand } from '../commands/AddCommand.js';
import { ConfigCommand } from '../commands/ConfigCommand.js';
import { InitCommand } from '../commands/InitCommand.js';
import { InstallCommand } from '../commands/InstallCommand.js';
import { ListCommand } from '../commands/ListCommand.js';
import { OutdatedCommand } from '../commands/OutdatedCommand.js';
import { PackCommand } from '../commands/PackCommand.js';
import { ProjectGetNameCommand } from '../commands/ProjectGetNameCommand.js';
import { RegistryCommand } from '../commands/RegistryCommand.js';
import { RemoveCommand } from '../commands/RemoveCommand.js';
import { UpdateCommand } from '../commands/UpdateCommand.js';
import { WhyCommand } from '../commands/WhyCommand.js';
import { InkPromptService } from '../prompts/InkPromptService.js';
import { ProjectContextDetector } from '../prompts/ProjectContextDetector.js';
import { CompositionRoot } from './CompositionRoot.js';

/**
 * Dispatcher: maps the parsed command-line shape to a concrete command
 * implementation, wiring dependencies via {@link CompositionRoot}.
 *
 * Every command now composes over {@link CompositionRoot}. The `init` and
 * `project-get-name` commands additionally receive a prompt service +
 * project-context detector (split out of the legacy `ui/` + `services/`
 * folders in Phase 10).
 */
export class UAPKGApplication {
  async run(commandLine: UAPKGCommandLine): Promise<number> {
    const root = new CompositionRoot({ cwd: commandLine.cwd });

    switch (commandLine.command) {
      case 'install':
        return new InstallCommand(root, {
          force: commandLine.force,
          frozen: commandLine.frozen,
          dryRun: commandLine.dryRun,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'add':
        return new AddCommand(root, {
          spec: commandLine.source,
          pin: commandLine.pin,
          dev: commandLine.dev,
          registry: commandLine.registry,
          force: commandLine.force,
          dryRun: commandLine.dryRun,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'update':
        return new UpdateCommand(root, {
          specs: commandLine.specs,
          force: commandLine.force,
          dryRun: commandLine.dryRun,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'remove':
        return new RemoveCommand(root, {
          packageName: commandLine.packageName,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'outdated':
        return new OutdatedCommand(root, { outputFormat: commandLine.outputFormat }).execute();

      case 'why':
        return new WhyCommand(root, {
          target: commandLine.target,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'list':
        return new ListCommand(root, {
          depth: commandLine.depth,
          outputFormat: commandLine.outputFormat,
        }).execute();

      case 'pack':
        return new PackCommand({
          cwd: commandLine.cwd,
          dryRun: commandLine.dryRun,
          allowMissingLfs: commandLine.allowMissingLfs,
          outFile: commandLine.outFile,
        }).execute();

      case 'config':
        return new ConfigCommand({
          cwd: commandLine.cwd,
          action: commandLine.action,
          pathToProperty: commandLine.path,
          rawValue: commandLine.value,
          scope: commandLine.scope,
          output: commandLine.output,
          showOrigin: commandLine.showOrigin,
          trace: commandLine.trace,
        }).execute();

      case 'registry':
        return new RegistryCommand({
          cwd: commandLine.cwd,
          action: commandLine.action,
          name: commandLine.name,
          url: commandLine.url,
          refType: commandLine.refType,
          refValue: commandLine.refValue,
          scope: commandLine.scope,
          output: commandLine.output,
        }).execute();

      case 'init':
        return new InitCommand(
          root,
          { explicitKind: commandLine.type, explicitName: commandLine.name },
          new ProjectContextDetector(),
          new InkPromptService(),
        ).execute();

      case 'project-get-name':
        return new ProjectGetNameCommand(root).execute();

      default: {
        const exhaustive: never = commandLine;
        void exhaustive;
        return 1;
      }
    }
  }
}
