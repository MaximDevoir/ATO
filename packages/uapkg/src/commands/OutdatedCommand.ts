import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';

export interface OutdatedCommandOptions {
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg outdated` — emits one row per declared dependency with
 * `current / wanted / latest / status` taken from
 * {@link PackageManifest.checkOutdated}.
 *
 * Exit code 0 when all rows are `up-to-date`; otherwise 2 so CI gates can
 * branch on it. JSON mode emits the full array on stdout in a single write.
 */
export class OutdatedCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: OutdatedCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const result = await this.root.packageManifest.checkOutdated();

    if (this.options.outputFormat === 'json') {
      this.root.json.emit({
        status: result.ok ? 'ok' : 'error',
        command: 'outdated',
        data: result.ok ? result.value : undefined,
        diagnostics: result.diagnostics,
      });
      return result.ok ? (result.value.some((r) => r.status !== 'up-to-date') ? 2 : 0) : 1;
    }

    this.root.diagnostics.reportAll(result.diagnostics);
    if (!result.ok) return 1;

    const rows = result.value;
    if (rows.length === 0) {
      process.stdout.write('No declared dependencies.\n');
      return 0;
    }
    const outdated = rows.filter((r) => r.status !== 'up-to-date');
    for (const row of rows) {
      process.stdout.write(
        `${row.status.padEnd(16)} ${row.name.padEnd(32)} ${row.current} → ${row.wanted} (latest ${row.latest})\n`,
      );
    }
    return outdated.length > 0 ? 2 : 0;
  }
}
