import { z } from 'zod';
import { BaseManifestSchema } from './BaseManifestSchema.js';
import { DependencySchema } from './DependencySchema.js';

/**
 * Project-only postinstall overrides.
 *
 * - `modules` — explicit list of Unreal module names to pass to postinstall
 *               scripts. Overrides the names discovered from the project's
 *               `.uproject` `Modules[]`. Intended for harness / test projects
 *               that want to limit which modules receive UAPKG-BEGIN/END
 *               injection blocks.
 */
export const ProjectPostinstallSchema = z
  .object({
    modules: z.array(z.string().min(1)).optional(),
  })
  .strict();

/**
 * Project manifest — the root `uapkg.json` for a project.
 *
 * Projects MAY specify `overrides` to pin transitive dependency versions.
 */
export const ProjectManifestSchema = BaseManifestSchema.extend({
  kind: z.literal('project'),
  overrides: z.record(z.string(), DependencySchema).optional(),
  postinstall: ProjectPostinstallSchema.optional(),
  dev: z
    .object({
      harness: z.unknown().optional(),
    })
    .optional(),
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export type ProjectPostinstall = z.infer<typeof ProjectPostinstallSchema>;
