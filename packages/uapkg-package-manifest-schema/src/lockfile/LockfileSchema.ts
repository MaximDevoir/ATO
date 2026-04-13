import { PackageNameSchema } from '@uapkg/common-schema';
import { z } from 'zod';
import { LockDependencySchema } from './LockDependencySchema.js';

/**
 * Schema for `uapkg.lock`.
 */
export const LockfileSchema = z.object({
  lockfileVersion: z.number().int(),
  packages: z.record(PackageNameSchema, LockDependencySchema),
});

export type Lockfile = z.infer<typeof LockfileSchema>;
