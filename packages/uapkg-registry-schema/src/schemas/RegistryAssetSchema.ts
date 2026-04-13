import { z } from 'zod';
import { IntegritySchema } from './IntegritySchema.js';

/**
 * A downloadable release asset with integrity metadata.
 */
export const RegistryAssetSchema = z.object({
  url: z.string().url(),
  integrity: IntegritySchema,
});

export type RegistryAsset = z.infer<typeof RegistryAssetSchema>;
