// ---------------------------------------------------------------------------
// @uapkg/diagnostics — public API
// ---------------------------------------------------------------------------

export type { DiagnosticBase } from './base/Diagnostic.js';
export { createDiagnostic } from './base/Diagnostic.js';
export { DiagnosticBag } from './base/DiagnosticBag.js';
// Base primitives
export type { DiagnosticLevel } from './base/DiagnosticLevel.js';
export type { Result, ResultFail, ResultOk } from './base/Result.js';
export { fail, fromDiagnostics, ok } from './base/Result.js';
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
// --- Manifest family ---
export type {
  ForbiddenOverridesDiagnostic,
  LockfileInvalidDiagnostic,
  ManifestDiagnostic,
  ManifestInvalidDiagnostic,
  ManifestReadErrorDiagnostic,
  ManifestWriteErrorDiagnostic,
  UnresolvedRegistryDiagnostic,
} from './manifest/ManifestDiagnostics.js';
export {
  createForbiddenOverridesDiagnostic,
  createLockfileInvalidDiagnostic,
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
} from './pack/PackDiagnostics.js';
// --- Registry family ---
export type {
  CacheReadErrorDiagnostic,
  GitErrorDiagnostic,
  LockAcquisitionFailedDiagnostic,
  NetworkErrorDiagnostic,
  RegistryDiagnostic,
  RegistryNotFoundDiagnostic,
  SchemaInvalidDiagnostic,
} from './registry/RegistryDiagnostics.js';
export {
  createCacheReadErrorDiagnostic,
  createGitErrorDiagnostic,
  createLockAcquisitionFailedDiagnostic,
  createNetworkErrorDiagnostic,
  createRegistryNotFoundDiagnostic,
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
// Unified type
export type { Diagnostic, DiagnosticByCode, DiagnosticCode } from './types.js';
