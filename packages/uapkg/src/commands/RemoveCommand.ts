import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';

export interface RemoveCommandOptions {
  readonly packageName: string;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg remove <name>` — removes a dependency from every bucket in the
 * manifest, re-resolves, and re-runs the installer. Currently an MVP:
 * runs the mutation + resolve, but the *disk removal* half is produced by
 * the installer's plan diff automatically on the next `install`.
 *
 * Full integration (post-remove installer run + postinstall hand-off) is
 * tracked in `final steps.md` deferred item.
 */
export class RemoveCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: RemoveCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const result = await this.root.packageManifest.removeDependency(this.options.packageName);

    if (this.options.outputFormat === 'json') {
      this.root.json.emit({
        status: result.ok ? 'ok' : 'error',
        command: 'remove',
        data: result.ok ? { removed: this.options.packageName } : undefined,
        diagnostics: result.diagnostics,
      });
      return result.ok ? 0 : 1;
    }

    this.root.diagnostics.reportAll(result.diagnostics);
    if (!result.ok) return 1;
    process.stdout.write(`Removed "${this.options.packageName}" from uapkg.json. Run \`uapkg install\` to remove from disk.\n`);
    return 0;
  }
}

