// ---------------------------------------------------------------------------
// @uapkg/registry-schema — public API
// ---------------------------------------------------------------------------

// Schemas
export { type Integrity, IntegritySchema } from './schemas/IntegritySchema.js';
export {
  type PackageRegistryManifest,
  PackageRegistryManifestSchema,
} from './schemas/PackageRegistryManifestSchema.js';
export { type PackageSource, PackageSourceSchema } from './schemas/PackageSourceSchema.js';
export { type RegistryAsset, RegistryAssetSchema } from './schemas/RegistryAssetSchema.js';
export { type RegistryDependency, RegistryDependencySchema } from './schemas/RegistryDependencySchema.js';
export {
  type RegistryVersion,
  RegistryVersionSchema,
  type ReleaseFiles,
  ReleaseFilesSchema,
  type VersionMeta,
  VersionMetaSchema,
} from './schemas/RegistryVersionSchema.js';
