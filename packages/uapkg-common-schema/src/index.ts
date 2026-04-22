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
// Added in Phase 0 (commands/installer/postinstall work)
export type { OrgName } from './primitives/OrgName.js';
export { OrgNameSchema } from './primitives/OrgName.js';
export type { ConcurrencyCount } from './primitives/ConcurrencyCount.js';
export { ConcurrencyCountSchema } from './primitives/ConcurrencyCount.js';
export type { DurationSeconds } from './primitives/DurationSeconds.js';
export { DurationSecondsSchema } from './primitives/DurationSeconds.js';
export type { PostInstallPolicy } from './primitives/PostInstallPolicy.js';
export { PostInstallPolicySchema, POSTINSTALL_POLICY_DEFAULT } from './primitives/PostInstallPolicy.js';
export type { InstallPath } from './primitives/InstallPath.js';
export { InstallPathSchema } from './primitives/InstallPath.js';
export type { PackageSpec } from './primitives/PackageSpec.js';
export { PackageSpecSchema } from './primitives/PackageSpec.js';
