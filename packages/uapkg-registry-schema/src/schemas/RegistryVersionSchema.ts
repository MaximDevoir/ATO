import { GitTreeSchema, PackageNameSchema, UnixTimestampSchema } from '@uapkg/common-schema';
import { z } from 'zod';
import { RegistryAssetSchema } from './RegistryAssetSchema.js';
import { RegistryDependencySchema } from './RegistryDependencySchema.js';

/**
 * Release files attached to a version.
 */
export const ReleaseFilesSchema = z.object({
  package: RegistryAssetSchema,
});

/**
 * Metadata about a published version.
 */
export const VersionMetaSchema = z.object({
  publishedAt: UnixTimestampSchema,
});

/**
 * A single version entry within a package registry manifest.
 */
export const RegistryVersionSchema = z.object({
  gitTree: GitTreeSchema,
  meta: VersionMetaSchema.optional(),
  releaseFiles: ReleaseFilesSchema,
  dependencies: z.record(PackageNameSchema, RegistryDependencySchema).optional(),
  devDependencies: z.record(PackageNameSchema, RegistryDependencySchema).optional(),
  peerDependencies: z.record(PackageNameSchema, RegistryDependencySchema).optional(),
});

export type RegistryVersion = z.infer<typeof RegistryVersionSchema>;
export type ReleaseFiles = z.infer<typeof ReleaseFilesSchema>;
export type VersionMeta = z.infer<typeof VersionMetaSchema>;
