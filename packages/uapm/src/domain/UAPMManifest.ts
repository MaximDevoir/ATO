import { z } from 'zod';

export const ManifestTypeSchema = z.enum(['project', 'plugin']);

export const DependencySourceSchema = z.union([
  z.string().startsWith('http'),
  z.string().startsWith('git@'),
  z.string().startsWith('file:'),
]);

export const DependencySchema = z.object({
  name: z.string().min(1),
  source: DependencySourceSchema,
  version: z.string().min(1).optional(),
});

export const DependencyOverrideSchema = z.object({
  name: z.string().min(1),
  source: DependencySourceSchema,
  version: z.string().min(1).optional(),
});

export const ProjectPostinstallSchema = z
  .object({
    modules: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const UAPMManifestSchema = z
  .object({
    name: z.string().min(1),
    type: ManifestTypeSchema,
    harness: z.string().min(1).optional(),
    dependencies: z.array(DependencySchema).optional(),
    overrides: z.array(DependencyOverrideSchema).optional(),
    harnessedPlugins: z.array(z.string().min(1)).optional(),
    postinstall: ProjectPostinstallSchema.optional(),
  })
  .superRefine((value: { harness?: string; postinstall?: unknown; type: string }, context: z.RefinementCtx) => {
    if (value.harness && value.type !== 'plugin') {
      context.addIssue({
        code: 'custom',
        message: 'harness is only valid for plugin manifests',
        path: ['harness'],
      });
    }
    if (value.postinstall && value.type !== 'project') {
      context.addIssue({
        code: 'custom',
        message: 'postinstall is only valid for project manifests',
        path: ['postinstall'],
      });
    }
  });

export type ManifestType = z.infer<typeof ManifestTypeSchema>;
export type Dependency = z.infer<typeof DependencySchema>;
export type DependencyOverride = z.infer<typeof DependencyOverrideSchema>;
export type UAPMManifest = z.infer<typeof UAPMManifestSchema>;
