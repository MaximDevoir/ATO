// ---------------------------------------------------------------------------
// @uapkg/diagnostics — public API
// ---------------------------------------------------------------------------

export type { DiagnosticBase, DiagnosticEmitPolicy } from './base/Diagnostic.js';
export { createDiagnostic } from './base/Diagnostic.js';
export { DiagnosticBag } from './base/DiagnosticBag.js';
// Base primitives
export type { DiagnosticLevel } from './base/DiagnosticLevel.js';
export type { Result, ResultFail, ResultOk } from './base/Result.js';
export { fail, fromDiagnostics, ok } from './base/Result.js';
// --- Config family ---
export type {
  ConfigDiagnostic,
  ConfigInvalidJsonDiagnostic,
  ConfigInvalidValueDiagnostic,
  ConfigTypeMismatchDiagnostic,
  ConfigUnknownKeyDiagnostic,
  ConfigUnresolvedDefaultRegistryDiagnostic,
} from './config/ConfigDiagnostics.js';
export {
  createConfigInvalidJsonDiagnostic,
  createConfigInvalidValueDiagnostic,
  createConfigTypeMismatchDiagnostic,
  createConfigUnknownKeyDiagnostic,
  createConfigUnresolvedDefaultRegistryDiagnostic,
} from './config/ConfigDiagnostics.js';
// --- General family ---
export type {
  GeneralDiagnostic,
  IoErrorDiagnostic,
  ParseErrorDiagnostic,
  UnknownErrorDiagnostic,
} from './general/GeneralDiagnostics.js';
export {
  createIoErrorDiagnostic,
  createParseErrorDiagnostic,
  createUnknownErrorDiagnostic,
} from './general/GeneralDiagnostics.js';
// --- Installer family ---
export type {
  DiskRemoveFailedDiagnostic,
  DownloadFailedDiagnostic,
  DownloadHttpStatusDiagnostic,
  ExtractionFailedDiagnostic,
  InstallerDiagnostic,
  IntegrityMismatchDiagnostic,
  NetworkRetriesExhaustedDiagnostic,
  NetworkTimeoutDiagnostic,
} from './installer/InstallerDiagnostics.js';
export {
  createDiskRemoveFailedDiagnostic,
  createDownloadFailedDiagnostic,
  createDownloadHttpStatusDiagnostic,
  createExtractionFailedDiagnostic,
  createIntegrityMismatchDiagnostic,
  createNetworkRetriesExhaustedDiagnostic,
  createNetworkTimeoutDiagnostic,
} from './installer/InstallerDiagnostics.js';
// --- Manifest family ---
export type {
  DependencyNotFoundDiagnostic,
  ForbiddenOverridesDiagnostic,
  LockfileInvalidDiagnostic,
  LockfileMissingDiagnostic,
  LockfileOutOfSyncDiagnostic,
  ManifestDiagnostic,
  ManifestInvalidDiagnostic,
  ManifestReadErrorDiagnostic,
  ManifestWriteErrorDiagnostic,
  UnresolvedRegistryDiagnostic,
} from './manifest/ManifestDiagnostics.js';
export {
  createDependencyNotFoundDiagnostic,
  createForbiddenOverridesDiagnostic,
  createLockfileInvalidDiagnostic,
  createLockfileMissingDiagnostic,
  createLockfileOutOfSyncDiagnostic,
  createManifestInvalidDiagnostic,
  createManifestReadErrorDiagnostic,
  createManifestWriteErrorDiagnostic,
  createUnresolvedRegistryDiagnostic,
} from './manifest/ManifestDiagnostics.js';
// --- Pack family ---
export type {
  CyclicSymlinkDiagnostic,
  InvalidPathDiagnostic,
  LfsSkippedDiagnostic,
  NoFilesSelectedDiagnostic,
  OutFileIsDirectoryDiagnostic,
  PackDiagnostic,
  PluginRootNotFoundDiagnostic,
  SymlinkOutsideRootDiagnostic,
  UnresolvedLfsDiagnostic,
  UpluginMissingDiagnostic,
} from './pack/PackDiagnostics.js';
export {
  createCyclicSymlinkDiagnostic,
  createInvalidPathDiagnostic,
  createLfsSkippedDiagnostic,
  createNoFilesSelectedDiagnostic,
  createOutFileIsDirectoryDiagnostic,
  createPluginRootNotFoundDiagnostic,
  createSymlinkOutsideRootDiagnostic,
  createUnresolvedLfsDiagnostic,
  createUpluginMissingDiagnostic,
} from './pack/PackDiagnostics.js';
// --- Postinstall family ---
export type {
  PostinstallDiagnostic,
  PostinstallDuplicateEntryDiagnostic,
  PostinstallEsbuildErrorDiagnostic,
  PostinstallInvalidExportDiagnostic,
  PostinstallLoadFailedDiagnostic,
  PostinstallMarkerCorruptDiagnostic,
  PostinstallPolicyDeniedDiagnostic,
} from './postinstall/PostinstallDiagnostics.js';
export {
  createPostinstallDuplicateEntryDiagnostic,
  createPostinstallEsbuildErrorDiagnostic,
  createPostinstallInvalidExportDiagnostic,
  createPostinstallLoadFailedDiagnostic,
  createPostinstallMarkerCorruptDiagnostic,
  createPostinstallPolicyDeniedDiagnostic,
} from './postinstall/PostinstallDiagnostics.js';
// --- Registry family ---
export type {
  CacheReadErrorDiagnostic,
  GitErrorDiagnostic,
  LockAcquisitionFailedDiagnostic,
  NetworkErrorDiagnostic,
  RegistryDiagnostic,
  RegistryNotFoundDiagnostic,
  RegistryUnreachableDiagnostic,
  SchemaInvalidDiagnostic,
} from './registry/RegistryDiagnostics.js';
export {
  createCacheReadErrorDiagnostic,
  createGitErrorDiagnostic,
  createLockAcquisitionFailedDiagnostic,
  createNetworkErrorDiagnostic,
  createRegistryNotFoundDiagnostic,
  createRegistryUnreachableDiagnostic,
  createSchemaInvalidDiagnostic,
} from './registry/RegistryDiagnostics.js';
// --- Resolver family ---
export type {
  CircularDepDiagnostic,
  PackageNotFoundDiagnostic,
  RegistryNameCollisionDiagnostic,
  ResolverDiagnostic,
  VersionConflictDiagnostic,
  VersionNotFoundDiagnostic,
} from './resolver/ResolverDiagnostics.js';
export {
  createCircularDepDiagnostic,
  createPackageNotFoundDiagnostic,
  createRegistryNameCollisionDiagnostic,
  createVersionConflictDiagnostic,
  createVersionNotFoundDiagnostic,
} from './resolver/ResolverDiagnostics.js';
// --- Safety family ---
export type {
  SafetyDiagnostic,
  SafetyOverriddenByForceDiagnostic,
  SafetyPathNotProjectManifestDiagnostic,
  SafetyTargetExistsNoManifestDiagnostic,
} from './safety/SafetyDiagnostics.js';
export {
  createSafetyOverriddenByForceDiagnostic,
  createSafetyPathNotProjectManifestDiagnostic,
  createSafetyTargetExistsNoManifestDiagnostic,
} from './safety/SafetyDiagnostics.js';
// --- Spec-parse family ---
export type {
  InvalidOrgNameDiagnostic,
  InvalidPackageSpecDiagnostic,
  InvalidVersionRangeDiagnostic,
  SpecParseDiagnostic,
} from './spec/SpecDiagnostics.js';
export {
  createInvalidOrgNameDiagnostic,
  createInvalidPackageSpecDiagnostic,
  createInvalidVersionRangeDiagnostic,
} from './spec/SpecDiagnostics.js';
// Unified type
export type { Diagnostic, DiagnosticByCode, DiagnosticCode } from './types.js';
