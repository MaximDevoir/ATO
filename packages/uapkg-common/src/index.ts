// ---------------------------------------------------------------------------
// @uapkg/common — public API
// ---------------------------------------------------------------------------

// Human formatting
export { prettyBytes, prettyBytesProgress } from './format/prettyBytes.js';
export {
  computeRegistryIdentifier,
  computeRegistryIdentifierShort,
  type RegistryIdentityDescriptor,
} from './hash/registryIdentifier.js';
// Hashing
export { sha256, sha256Prefixed } from './hash/sha256.js';
export { safeJsonParse } from './json/safeJsonParse.js';
// JSON
export { stableStringify } from './json/stableStringify.js';
// Normalization
export { normalizeUrl } from './normalize/normalizeUrl.js';
// Paths
export { normalizePath, toForwardSlash } from './paths/forwardSlash.js';
// Package spec parsing (CLI "@org/name@range")
export { formatPackageSpec, parsePackageSpec } from './spec/parsePackageSpec.js';
