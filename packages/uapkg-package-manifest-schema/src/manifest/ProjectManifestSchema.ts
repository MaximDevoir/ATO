import { z } from 'zod';
import { BaseManifestSchema } from './BaseManifestSchema.js';
import { DependencySchema } from './DependencySchema.js';

/**
 * Project manifest — the root `uapkg.json` for a project.
 *
 * Projects MAY specify `overrides` to pin transitive dependency versions.
 */
export const ProjectManifestSchema = BaseManifestSchema.extend({
  kind: z.literal('project'),
  overrides: z.record(z.string(), DependencySchema).optional(),
  dev: z
    .object({
      harness: z.unknown().optional(),
    })
    .optional(),
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
