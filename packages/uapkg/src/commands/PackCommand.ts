import Log from '@uapkg/log';
import { pack } from '@uapkg/pack';
import type { Command } from './Command.js';

export interface PackCommandOptions {
  cwd: string;
  dryRun: boolean;
  allowMissingLfs: boolean;
  outFile?: string;
}

export class PackCommand implements Command {
  constructor(private readonly options: PackCommandOptions) {}

  async execute() {
    const result = await pack({
      cwd: this.options.cwd,
      dryRun: this.options.dryRun,
      allowMissingLfs: this.options.allowMissingLfs,
      outFile: this.options.outFile,
    });

    if (!result.ok) {
      for (const d of result.diagnostics) {
        Log.error(`[${d.code}] ${d.message}`);
      }
      return 1;
    }

    return 0;
  }
}
