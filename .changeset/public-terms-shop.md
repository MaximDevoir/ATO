---
"@uapkg/package-manifest-schema": patch
"@uapkg/diagnostics-format": patch
"@uapkg/package-manifest": patch
"@uapkg/registry-schema": patch
"@uapkg/common-schema": patch
"@uapkg/registry-core": patch
"@uapkg/diagnostics": patch
"@uapkg/common": patch
"@uapkg/config": patch
"@uapkg/pack": patch
"uapkg": patch
"@maximdevoir/ati": patch
"@maximdevoir/ato": patch
"@maximdevoir/create-atc-harness": patch
"@maximdevoir/engine-association-resolver": patch
"@uapkg/log": patch
"@maximdevoir/unreal-lag": patch
---

# New Package: `@uapkg/diagnostics`

**Location:** `packages/uapkg-diagnostics/`

Provides structured, throw-free error handling across the `uapkg` monorepo.

---

## Core Types & Utilities

- `Diagnostic`
  Base type with: `level`, `code`, `message`, `hint`, `data`

- `DiagnosticBag`
  Collector with:
  - `add()`
  - `mergeArray()`
  - `hasErrors()`
  - `toFailure()`

- `Result<T>`
  Union type:
  - `ResultOk<T>`
  - `ResultFail`

- Factory helpers:
  - `ok()`
  - `fail()`
  - `fromDiagnostics()`

---

## Diagnostic Families

### General

- `PARSE_ERROR`
- `IO_ERROR`
- `UNKNOWN_ERROR`

### Manifest

- `MANIFEST_INVALID`
- `LOCKFILE_INVALID`
- `FORBIDDEN_OVERRIDES`
- `UNRESOLVED_REGISTRY`
- `MANIFEST_READ_ERROR`
- `MANIFEST_WRITE_ERROR`

### Registry

- `SCHEMA_INVALID`
- `GIT_ERROR`
- `NETWORK_ERROR`
- `REGISTRY_NOT_FOUND`
- `CACHE_READ_ERROR`
- `LOCK_ACQUISITION_FAILED`

### Resolver

- `VERSION_CONFLICT`
- `VERSION_NOT_FOUND`
- `PACKAGE_NOT_FOUND`
- `CIRCULAR_DEP`
- `REGISTRY_NAME_COLLISION`

### Pack

- `CYCLIC_SYMLINK`
- `SYMLINK_OUTSIDE_ROOT`
- `INVALID_PATH`
- `PLUGIN_ROOT_NOT_FOUND`
- `UNRESOLVED_LFS`
- `LFS_SKIPPED`
- `NO_FILES_SELECTED`
- `OUTFILE_IS_DIRECTORY`

---

# Updates

## `@uapkg/config`

- `ConfigFileRepository.read()` → `Result<ConfigReadResult>`
- `ConfigFileRepository.write()` → `Result<void>`

- `ConfigWriter`
  - `getRaw()`
  - `listRaw()`
  - `prepareSet()`
  - `prepareDelete()`
    → all return `Result<T>`

- `ConfigLayerBuilder`
  Returns empty values on read failure

- `ConfigInstance`
  Handles `Result` internally, exposes clean API

- `pathSchema.validateConfigPath()` → `Result<void>`

---

## `@uapkg/pack`

- `PackService.pack()` → `Promise<Result<PackResult>>`
- `FileCrawler.collect()` → `Result<CollectedFile[]>`
- `PluginRootResolver.resolve()` → `Result<ResolvedRoots>`
- `PackManifestReader.read()` → `Result<PackManifest>`

---

## CLI

- `ConfigCommand`
  - Handles `Result` from config operations
  - Returns exit code `1` on failure
  - Prints diagnostics

- `PackCommand`
  - Handles `Result` from `pack()`
  - Logs diagnostics on failure

---

# Tests

- `diagnostics.test.ts`
  Covers `Result`, `DiagnosticBag`, and helpers

- `config-instance.test.ts`
  Updated for nullable `getWithOrigin`

- `pack-service.test.ts`
  Unwraps `Result` before accessing values
