import { z } from 'zod';

/**
 * Describes where the package source lives.
 */
export const PackageSourceSchema = z.object({
  type: z.literal('git'),
  url: z.string().url(),
});

export type PackageSource = z.infer<typeof PackageSourceSchema>;
