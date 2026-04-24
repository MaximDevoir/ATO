import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';
import { InstallCommand } from './InstallCommand.js';

export interface RemoveCommandOptions {
  readonly packageName: string;
  readonly outputFormat: 'text' | 'json';
  readonly dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// RemoveCommand — removes a dependency from every bucket in the manifest and
// then immediately re-runs `InstallCommand` so on-disk state is reconciled.
//
// The installer's plan diff is what actually deletes the installed plugin —
// RemoveCommand's job is (1) mutate the manifest, (2) trigger the install.
// ---------------------------------------------------------------------------
export class RemoveCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: RemoveCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const result = await this.root.packageManifest.removeDependency(this.options.packageName);

    if (!result.ok) {
      if (this.options.outputFormat === 'json') {
        this.root.json.emit({ status: 'error', command: 'remove', diagnostics: result.diagnostics });
      } else {
        this.root.diagnostics.reportAll(result.diagnostics);
      }
      return 1;
    }

    const missing = result.diagnostics.some((d) => d.code === 'DEPENDENCY_NOT_FOUND');

    if (result.diagnostics.length > 0 && this.options.outputFormat === 'text') {
      this.root.diagnostics.reportAll(result.diagnostics);
    }

    if (missing) {
      if (this.options.outputFormat === 'json') {
        this.root.json.emit({
          status: 'ok',
          command: 'remove',
          data: { removed: false, packageName: this.options.packageName },
          diagnostics: result.diagnostics,
        });
      }
      return 0;
    }

    if (this.options.outputFormat === 'text') {
      process.stdout.write(`Removed "${this.options.packageName}" from uapkg.json\n`);
    }

    // Reconcile on-disk state by delegating to the installer pipeline.
    const install = new InstallCommand(this.root, {
      force: false,
      frozen: false,
      dryRun: this.options.dryRun === true,
      outputFormat: this.options.outputFormat,
    });
    return install.execute();
  }
}
