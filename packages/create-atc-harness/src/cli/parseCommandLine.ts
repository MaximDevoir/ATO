import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CommandLineOptions } from '../domain/CommandLineOptions';

export async function parseCreateATCHarnessCommandLine(rawArgv = process.argv): Promise<CommandLineOptions> {
  const argv = await yargs(hideBin(rawArgv))
    .scriptName('create-atc-harness')
    .usage('$0 <manifestString> <outputRootDirectory> [options]')
    .parserConfiguration({
      'unknown-options-as-args': true,
      'camel-case-expansion': true,
    })
    .strict(false)
    .positional('manifestString', {
      type: 'string',
      demandOption: true,
      describe: 'Path to atc.json, folder containing atc.json, or Git repository link',
    })
    .positional('outputRootDirectory', {
      type: 'string',
      demandOption: true,
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
    .help()
    .parse();

  const manifestString = String(argv._[0] ?? '').trim();
  const outputRootDirectory = String(argv._[1] ?? '').trim();
  if (!manifestString || !outputRootDirectory) {
    throw new Error('[create-atc-harness] Both manifestString and outputRootDirectory are required');
  }

  return {
    manifestString,
    outputRootDirectory,
    harness: typeof argv.harness === 'string' ? argv.harness : undefined,
    engineAssociation: typeof argv.engineAssociation === 'string' ? argv.engineAssociation : undefined,
    argv: argv as Record<string, unknown>,
    rawArgv: [...rawArgv],
  };
}
