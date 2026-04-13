// ---------------------------------------------------------------------------
// @uapkg/common-schema — public API
// ---------------------------------------------------------------------------

// Brand utility
export type { Brand } from './brand/Brand.js';
export type { AssetHash } from './primitives/AssetHash.js';
export { AssetHashSchema } from './primitives/AssetHash.js';
export type { GitTree } from './primitives/GitTree.js';
export { GitTreeSchema } from './primitives/GitTree.js';
// Branded primitives — types
export type { PackageName } from './primitives/PackageName.js';
// Branded primitives — Zod schemas
export { PackageNameSchema } from './primitives/PackageName.js';
export type { PackageVersion } from './primitives/PackageVersion.js';
export { PackageVersionSchema } from './primitives/PackageVersion.js';
export type { RegistryIdentifier, RegistryIdentifierShort } from './primitives/RegistryIdentifier.js';
export { RegistryIdentifierSchema, RegistryIdentifierShortSchema } from './primitives/RegistryIdentifier.js';
export type { RegistryName } from './primitives/RegistryName.js';
export { RegistryNameSchema } from './primitives/RegistryName.js';
export type { RegistryURL } from './primitives/RegistryURL.js';
export { RegistryURLSchema } from './primitives/RegistryURL.js';
export type { UnixTimestamp } from './primitives/UnixTimestamp.js';
export { UnixTimestampSchema } from './primitives/UnixTimestamp.js';
export type { VersionRange } from './primitives/VersionRange.js';
export { VersionRangeSchema } from './primitives/VersionRange.js';
