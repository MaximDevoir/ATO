import type { Argv } from 'yargs';
import { createUAPKGCommandLineFactory } from '../../UAPKGCommandLine';
import type { CommandLineSink, UAPKGCommandModule } from '../contracts/UAPKGCommandModule';
import { resolveScope, withScopeOptions } from './sharedOptions';

export class ConfigCommandModule implements UAPKGCommandModule {
  private readonly factory = createUAPKGCommandLineFactory();

  register(parser: Argv, sink: CommandLineSink) {
    return parser.command(
      'config <action> [path] [value]',
      'Read and edit configuration values',
      (builder) =>
        withScopeOptions(builder)
          .positional('action', {
            type: 'string',
            choices: ['get', 'list', 'set', 'delete', 'edit'] as const,
            describe: 'Config action',
            demandOption: true,
          })
          .positional('path', {
            type: 'string',
            describe: 'Path to property',
          })
          .positional('value', {
            type: 'string',
            describe: 'JSON value for set action',
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
          }),
      (argv) => {
        const scope = resolveScope(argv.global === true, argv.local === true);
        const output = argv.json === true ? 'json' : 'text';
        const action = String(argv.action);
        const cwd = process.cwd();

        switch (action) {
          case 'get':
            sink.set(
              this.factory.createConfigGet(typeof argv.path === 'string' ? argv.path : '', {
                cwd,
                scope,
                output,
                showOrigin: argv['show-origin'] === true,
                trace: argv.trace === true,
              }),
            );
            return;
          case 'list':
            sink.set(
              this.factory.createConfigList({
                cwd,
                scope,
                output,
              }),
            );
            return;
          case 'set':
            sink.set(
              this.factory.createConfigSet(
                typeof argv.path === 'string' ? argv.path : '',
                typeof argv.value === 'string' ? argv.value : '',
                {
                  cwd,
                  scope,
                  output,
                },
              ),
            );
            return;
          case 'delete':
            sink.set(
              this.factory.createConfigDelete(typeof argv.path === 'string' ? argv.path : '', {
                cwd,
                scope,
                output,
              }),
            );
            return;
          case 'edit':
            sink.set(
              this.factory.createConfigEdit({
                cwd,
                scope,
                output,
              }),
            );
            return;
          default:
            throw new Error(`[uapkg] Unsupported config action: ${action}`);
        }
      },
    );
  }
}
