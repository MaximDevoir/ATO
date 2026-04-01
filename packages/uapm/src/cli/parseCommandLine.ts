import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { UAPMCommandLine, UAPMCommandName } from './UAPMCommandLine';

export async function parseUAPMCommandLine(rawArgv = process.argv): Promise<UAPMCommandLine> {
  const parser = yargs(hideBin(rawArgv))
    .scriptName('uapm')
    .usage('$0 <command> [args]')
    .command('init', 'Initialize uapm.json')
    .command('add <source>', 'Add dependency source to current uapm.json')
    .command('install', 'Install dependency graph for current manifest')
    .command('update', 'Update dependency graph and lockfile from remote refs')
    .option('type', {
      type: 'string',
      choices: ['project', 'plugin', 'harness'] as const,
      describe: 'Explicit manifest type for init',
    })
    .option('name', {
      type: 'string',
      describe: 'Explicit package name for init',
    })
    .option('force', {
      type: 'boolean',
      default: false,
      describe: 'Override safety policy for local drift/branch divergence',
    })
    .demandCommand(1)
    .help()
    .strict(false);

  const argv = await parser.parse();
  const command = String(argv._[0] ?? '').trim() as UAPMCommandName;
  if (!['init', 'add', 'install', 'update'].includes(command)) {
    throw new Error(`[uapm] Unknown command '${command}'. Supported: init, add, install, update`);
  }

  return {
    command,
    cwd: process.cwd(),
    args: argv._.slice(1).map((value) => String(value)),
    type: argv.type as UAPMCommandLine['type'],
    name: typeof argv.name === 'string' ? argv.name : undefined,
    force: argv.force === true,
  };
}
