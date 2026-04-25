import { AssetHashSchema, GitTreeSchema, PackageVersionSchema, RegistryNameSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * A locked (resolved) dependency entry in `uapkg.lock`.
 */
export const LockDependencySchema = z.object({
  version: PackageVersionSchema,
  registry: RegistryNameSchema,
  integrity: AssetHashSchema,
  gitTree: GitTreeSchema,
  dependencies: z.record(z.string(), z.string()).optional(),
});

export type LockDependency = z.infer<typeof LockDependencySchema>;
