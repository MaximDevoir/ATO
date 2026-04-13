import { RegistryNameSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * Optional publish configuration within `uapkg.json`.
 */
export const PublishSchema = z.object({
  registry: RegistryNameSchema.optional(),
});

export type Publish = z.infer<typeof PublishSchema>;
