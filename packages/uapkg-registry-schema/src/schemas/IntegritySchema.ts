import { AssetHashSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * Integrity block for a release asset.
 */
export const IntegritySchema = z.object({
  hash: AssetHashSchema,
  size: z.number().int().nonnegative(),
});

export type Integrity = z.infer<typeof IntegritySchema>;
