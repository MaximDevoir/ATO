import { PackageNameSchema, PackageVersionSchema } from '@uapkg/common-schema';
import { z } from 'zod';
import { DependencySchema } from './DependencySchema.js';
import { ManifestKindSchema } from './ManifestKind.js';
import { PublishSchema } from './PublishSchema.js';

/**
 * Fields shared by all manifest kinds.
 */
export const BaseManifestSchema = z.object({
  name: PackageNameSchema,
  version: PackageVersionSchema,
  kind: ManifestKindSchema,
  private: z.boolean().optional(),
  publish: PublishSchema.optional(),
  dependencies: z.record(z.string(), DependencySchema).optional(),
  devDependencies: z.record(z.string(), DependencySchema).optional(),
  peerDependencies: z.record(z.string(), DependencySchema).optional(),
});

export type BaseManifest = z.infer<typeof BaseManifestSchema>;
