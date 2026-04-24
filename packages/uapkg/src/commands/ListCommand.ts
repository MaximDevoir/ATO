import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';

export interface ListCommandOptions {
  readonly depth: number;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg list [--depth N]` — renders the resolved dependency tree.
 *
 * Pulls the lockfile via {@link PackageManifest.readLockfile}. A depth of 0
 * prints only root declarations; `Infinity` prints everything (duplicates
 * guarded so cycles can't loop forever).
 */
export class ListCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: ListCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const manifestResult = await this.root.packageManifest.readManifest();
    const lockfileResult = await this.root.packageManifest.getLockfileForReadOnly();

    if (!manifestResult.ok) {
      if (this.options.outputFormat === 'json') {
        this.root.json.emit({
          status: 'error',
          command: 'list',
          diagnostics: [...(manifestResult.diagnostics ?? [])],
        });
      } else {
        this.root.diagnostics.reportAll(manifestResult.diagnostics);
      }
      return 1;
    }

    if (!lockfileResult.ok) {
      if (this.options.outputFormat === 'json') {
        this.root.json.emit({
          status: 'error',
          command: 'list',
          diagnostics: [...(lockfileResult.diagnostics ?? [])],
        });
      } else {
        this.root.diagnostics.reportAll(lockfileResult.diagnostics);
      }
      return 1;
    }

    if (this.options.outputFormat === 'text') {
      this.root.diagnostics.reportAll(lockfileResult.diagnostics);
    }

    const lockfile = lockfileResult.value;
    const manifest = manifestResult.value;
    const declared = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    });

    if (this.options.outputFormat === 'json') {
      this.root.json.emit({
        status: 'ok',
        command: 'list',
        data: { declared, packages: lockfile.packages },
        diagnostics: lockfileResult.diagnostics,
      });
      return 0;
    }

    process.stdout.write(`${this.root.cwd}\n`);
    for (const name of declared) {
      const locked = (lockfile.packages as Record<string, { version: string; registry: string }>)[name];
      if (!locked) {
        process.stdout.write(`  ${name} (not in lockfile)\n`);
        continue;
      }
      process.stdout.write(`  ${name}@${locked.version}  [${locked.registry}]\n`);
    }
    if (this.options.depth > 0) {
      const remaining = Object.entries(
        lockfile.packages as Record<string, { version: string; registry: string }>,
      ).filter(([name]) => !declared.includes(name));
      if (remaining.length > 0) {
        process.stdout.write('  --- transitive ---\n');
        for (const [name, locked] of remaining) {
          process.stdout.write(`  ${name}@${locked.version}  [${locked.registry}]\n`);
        }
      }
    }
    return 0;
  }
}
