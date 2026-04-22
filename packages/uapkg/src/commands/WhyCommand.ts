import type { PackageName } from '@uapkg/common-schema';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';

export interface WhyCommandOptions {
  readonly target: string;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg why <name>` — prints every dependency path from a graph root to the
 * target package. Implemented as a pure consumer of
 * {@link PackageManifest.explainWhy}.
 *
 * Exit code 0 when the target is present, 3 when not found, 1 on any
 * resolver error.
 */
export class WhyCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: WhyCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const target = this.options.target as PackageName;
    const result = await this.root.packageManifest.explainWhy(target);

    if (this.options.outputFormat === 'json') {
      this.root.json.emit({
        status: result.ok ? 'ok' : 'error',
        command: 'why',
        data: result.ok ? result.value : undefined,
        diagnostics: result.diagnostics,
      });
      return result.ok ? (result.value.paths.length === 0 && !result.value.foundAsRoot ? 3 : 0) : 1;
    }

    this.root.diagnostics.reportAll(result.diagnostics);
    if (!result.ok) return 1;

    const { paths, foundAsRoot } = result.value;
    if (paths.length === 0 && !foundAsRoot) {
      process.stdout.write(`No installation of "${target}" in the resolved graph.\n`);
      return 3;
    }
    if (foundAsRoot) {
      process.stdout.write(`${target} (declared at root)\n`);
    }
    for (const p of paths) {
      const rendered = p.path.map((e) => `${e.name}@${e.version}`).join(' → ');
      process.stdout.write(`  ${rendered}\n`);
    }
    return 0;
  }
}

