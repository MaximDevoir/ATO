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
    .command('config <action> [path] [value]', 'Read and edit configuration values')
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
    .option('global', {
      type: 'boolean',
      default: false,
      describe: 'Use global configuration scope',
    })
    .option('local', {
      type: 'boolean',
      default: false,
      describe: 'Use local configuration scope',
    })
    .option('json', {
      type: 'boolean',
      default: false,
      describe: 'Output JSON',
    })
    .option('show-origin', {
      type: 'boolean',
      default: false,
      describe: 'Show value origin',
    })
    .option('trace', {
      type: 'boolean',
      default: false,
      describe: 'Trace value across all layers',
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
      : first === 'config'
        ? ('config' as UAPKGCommandName)
        : (first as UAPKGCommandName);
  if (!['init', 'add', 'install', 'update', 'project-get-name', 'config'].includes(command)) {
    throw new Error(
      `[uapkg] Unknown command '${first}'. Supported: init, add, install, update, project get name, config`,
    );
  }

  const rawConfigAction = command === 'config' && typeof argv.action === 'string' ? argv.action : undefined;
  const configAction =
    rawConfigAction && ['get', 'list', 'set', 'delete', 'edit'].includes(rawConfigAction)
      ? (rawConfigAction as UAPKGCommandLine['configAction'])
      : undefined;
  const positionalArgs =
    command === 'project-get-name'
      ? []
      : command === 'config'
        ? [argv.path, argv.value].filter((value) => value !== undefined).map((value) => String(value))
        : argv._.slice(1).map((value) => String(value));

  return {
    command,
    cwd: process.cwd(),
    args: positionalArgs,
    type: argv.type as UAPKGCommandLine['type'],
    name: typeof argv.name === 'string' ? argv.name : undefined,
    force: argv.force === true,
    pin: argv.pin === true,
    harnessed: argv.harnessed === true,
    configAction,
    json: argv.json === true,
    global: argv.global === true,
    local: argv.local === true,
    showOrigin: argv['show-origin'] === true,
    trace: argv.trace === true,
  };
}
