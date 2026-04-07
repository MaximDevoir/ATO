import { z } from 'zod';
import type { ResolvedConfig } from '../contracts/ConfigTypes.js';

const registryRefSchema = z
  .object({
    type: z.enum(['branch', 'tag', 'rev']),
    value: z.string().min(1),
  })
  .strict();

const registryConfigSchema = z
  .object({
    url: z.string().min(1),
    ref: registryRefSchema.default({
      type: 'branch',
      value: 'main',
    }),
  })
  .strict();

export const configSchema = z
  .object({
    registry: z.string().min(1),
    registries: z.record(z.string(), registryConfigSchema),
    git: z.string().min(1),
    editor: z.string().min(1),
    exec: z
      .object({
        shell: z.string().min(1),
      })
      .strict(),
    cache: z
      .object({
        enabled: z.boolean(),
      })
      .strict(),
    network: z
      .object({
        retries: z.number(),
        timeout: z.number(),
      })
      .strict(),
    term: z
      .object({
        quiet: z.boolean(),
        verbose: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!(value.registry in value.registries)) {
      context.addIssue({
        code: 'custom',
        message: `registry must match a key in registries: '${value.registry}' was not found`,
        path: ['registry'],
      });
    }
  });

export const partialConfigSchema = z
  .object({
    registry: z.string().min(1).optional(),
    registries: z.record(z.string(), registryConfigSchema).optional(),
    git: z.string().min(1).optional(),
    editor: z.string().min(1).optional(),
    exec: z
      .object({
        shell: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    cache: z
      .object({
        enabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    network: z
      .object({
        retries: z.number().optional(),
        timeout: z.number().optional(),
      })
      .strict()
      .optional(),
    term: z
      .object({
        quiet: z.boolean().optional(),
        verbose: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function resolveEditorDefault() {
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  if (process.env.VISUAL) {
    return process.env.VISUAL;
  }

  if (process.platform === 'win32') {
    const systemRoot = process.env.SYSTEMROOT ?? 'C:\\Windows';
    return `${systemRoot}\\notepad.exe`;
  }

  return 'vi';
}

function resolveShellDefault() {
  return process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
}

export function getDefaultConfig(): ResolvedConfig {
  return {
    registry: 'default',
    registries: {
      default: {
        url: 'https://github.com/uapkg/registry',
        ref: {
          type: 'branch',
          value: 'main',
        },
      },
    },
    git: 'git',
    editor: resolveEditorDefault(),
    exec: {
      shell: resolveShellDefault(),
    },
    cache: {
      enabled: true,
    },
    network: {
      retries: 2,
      timeout: 300,
    },
    term: {
      quiet: false,
      verbose: false,
    },
  };
}
