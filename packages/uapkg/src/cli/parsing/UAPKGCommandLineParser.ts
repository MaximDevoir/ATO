import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { UAPKGCommandLine } from '../UAPKGCommandLine';
import { UAPKGParserRegistry } from './UAPKGParserRegistry';

export class UAPKGCommandLineParser {
  constructor(private readonly registry = new UAPKGParserRegistry()) {}

  async parse(rawArgv = process.argv): Promise<UAPKGCommandLine> {
    let parsed: UAPKGCommandLine | undefined;

    const parser = this.registry
      .registerAll(
        yargs(hideBin(rawArgv)).scriptName('uapkg').usage('$0 <command> [args]').demandCommand(1).strict().help(),
        {
          set(commandLine) {
            parsed = commandLine;
          },
        },
      )
      .wrap(Math.min(120, yargs().terminalWidth()));

    await parser.parse();

    if (!parsed) {
      throw new Error('[uapkg] Failed to resolve command line input');
    }

    return parsed;
  }
}
