import { RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * A dependency entry stored inside a registry version.
 *
 * Both `version` (range) and `registry` (logical name) are required
 * so that multi-registry resolution can work.
 */
export const RegistryDependencySchema = z.object({
  version: VersionRangeSchema,
  registry: RegistryNameSchema,
});

export type RegistryDependency = z.infer<typeof RegistryDependencySchema>;
