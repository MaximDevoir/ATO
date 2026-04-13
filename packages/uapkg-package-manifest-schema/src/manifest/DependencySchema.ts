import { RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * A dependency intent entry in `uapkg.json`.
 *
 * Both `version` (semver range) and `registry` (logical name) are explicit.
 */
export const DependencySchema = z.object({
  version: VersionRangeSchema,
  registry: RegistryNameSchema,
});

export type Dependency = z.infer<typeof DependencySchema>;
