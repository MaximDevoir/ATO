import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';
import { InstallCommand } from './InstallCommand.js';

export interface UpdateCommandOptions {
  readonly specs: readonly string[];
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg update [specs...]` — re-resolve and re-install.
 *
 * MVP behavior: triggers a full re-resolve by calling `InstallCommand` with
 * `frozen: false`. The `specs` filter (update only these names) is tracked as
 * a follow-up — the new `Resolver` does not yet expose a per-name selective
 * re-resolve API.
 *
 * For now, specs are echoed in the output so the CLI surface is stable and
 * the follow-up is a small resolver addition rather than a CLI change.
 */
export class UpdateCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: UpdateCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const install = new InstallCommand(this.root, {
      force: this.options.force,
      frozen: false,
      dryRun: this.options.dryRun,
      outputFormat: this.options.outputFormat,
    });
    return install.execute();
  }
}
