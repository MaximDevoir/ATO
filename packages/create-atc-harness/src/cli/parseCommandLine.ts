import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CommandLineOptions } from '../domain/CommandLineOptions';

export async function parseCreateATCHarnessCommandLine(rawArgv = process.argv): Promise<CommandLineOptions> {
  const parser = yargs(hideBin(rawArgv))
    .scriptName('create-atc-harness')
    .usage('$0 <manifestString> <outputRootDirectory> [options]')
    .parserConfiguration({
      'unknown-options-as-args': true,
      'camel-case-expansion': true,
    })
    .strict(false)
    .fail((msg, err, yargsInstance) => {
      if (msg) {
        console.error(`\n[create-atc-harness] ${msg}`);
      }

      if (err) {
        console.error(err.message);
      }

      console.log('\n');
      yargsInstance.showHelp();
      process.exit(1);
    })
    .positional('manifestString', {
      type: 'string',
      describe: 'Path to atc.json, folder containing atc.json, or Git repository link',
    })
    .positional('outputRootDirectory', {
      type: 'string',
      describe: 'Directory where the harness host project should be created',
    })
    .option('harness', {
      type: 'string',
      describe: 'Force a specific harness creator by HarnessCreator.name',
    })
    .option('engineAssociation', {
      type: 'string',
      describe: 'Engine association key, engine path, or "first"',
    })
    .demandCommand(2, '[create-atc-harness] You must provide manifestString and outputRootDirectory')
    .help()
    .wrap(Math.min(120, yargs().terminalWidth()));

  const argv = await parser.parse();

  const manifestString = String(argv._[0] ?? '').trim();
  const outputRootDirectory = String(argv._[1] ?? '').trim();

  return {
    manifestString,
    outputRootDirectory,
    harness: typeof argv.harness === 'string' ? argv.harness : undefined,
    engineAssociation: typeof argv.engineAssociation === 'string' ? argv.engineAssociation : undefined,
    argv: argv as Record<string, unknown>,
    rawArgv: [...rawArgv],
  };
}
