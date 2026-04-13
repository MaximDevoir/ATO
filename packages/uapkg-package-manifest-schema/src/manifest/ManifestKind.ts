import { z } from 'zod';

/**
 * Manifest kind determines schema-level constraints.
 *
 * - `project`  — root project manifest (may have overrides)
 * - `plugin`   — plugin manifest (must NOT have overrides)
 *
 * Future kinds (e.g. `shard`) can be added here.
 */
export const ManifestKindSchema = z.enum(['project', 'plugin']);

export type ManifestKind = z.infer<typeof ManifestKindSchema>;
