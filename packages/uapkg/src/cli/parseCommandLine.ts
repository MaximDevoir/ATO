import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { UAPKGCommandLine, UAPKGCommandName } from './UAPKGCommandLine';

export async function parseUAPKGCommandLine(rawArgv = process.argv): Promise<UAPKGCommandLine> {
  const parser = yargs(hideBin(rawArgv))
    .scriptName('uapkg')
    .usage('$0 <command> [args]')
    .command('init', 'Initialize uapkg.json')
    .command('add <source>', 'Add dependency source to current uapkg.json')
    .command('install', 'Install dependency graph for current manifest')
    .command('update', 'Update dependency graph and lockfile from remote refs')
    .command('project get name', 'Get current project name from uapkg.json when manifest type is project')
    .option('type', {
      type: 'string',
      choices: ['project', 'plugin'] as const,
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
    .option('pin', {
      type: 'boolean',
      default: false,
      describe: 'Add/replace project override for this dependency',
    })
    .option('harnessed', {
      type: 'boolean',
      default: false,
      describe: 'Mark dependency as harnessed (tracked in lockfile, but protected during updates)',
    })
    .demandCommand(1)
    .help()
    .strict(false);

  const argv = await parser.parse();
  const first = String(argv._[0] ?? '').trim();
  const second = String(argv._[1] ?? '').trim();
  const third = String(argv._[2] ?? '').trim();
  const command =
    first === 'project' && second === 'get' && third === 'name'
      ? ('project-get-name' as UAPKGCommandName)
      : (first as UAPKGCommandName);
  if (!['init', 'add', 'install', 'update', 'project-get-name'].includes(command)) {
    throw new Error(`[uapkg] Unknown command '${first}'. Supported: init, add, install, update, project get name`);
  }

  return {
    command,
    cwd: process.cwd(),
    args: command === 'project-get-name' ? [] : argv._.slice(1).map((value) => String(value)),
    type: argv.type as UAPKGCommandLine['type'],
    name: typeof argv.name === 'string' ? argv.name : undefined,
    force: argv.force === true,
    pin: argv.pin === true,
    harnessed: argv.harnessed === true,
  };
}
