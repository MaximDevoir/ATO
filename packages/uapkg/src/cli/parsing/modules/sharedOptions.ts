import type { Argv } from 'yargs';

export function withScopeOptions<T extends Argv>(parser: T) {
  return parser
    .option('global', {
      type: 'boolean',
      default: false,
      describe: 'Use global configuration scope',
    })
    .option('local', {
      type: 'boolean',
      default: false,
      describe: 'Use local configuration scope',
    });
}

export function resolveScope(global: boolean, local: boolean) {
  if (global && local) {
    throw new Error('[uapkg] --global and --local cannot be used together');
  }

  if (global) {
    return 'global' as const;
  }

  if (local) {
    return 'local' as const;
  }

  return undefined;
}
