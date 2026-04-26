# @maximdevoir/ati

## 1.1.4

### Patch Changes

- [`9a201d9`](https://github.com/MaximDevoir/ATO/commit/9a201d991610054f0fcde5d3d4e352809af10d9d) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - fix: refactor to replace `uapkg` package with `@uapkg/cli` across dependencies and services

## 1.1.3

### Patch Changes

- [`59a1226`](https://github.com/MaximDevoir/ATO/commit/59a1226a5a5e4d9e44495d5b8b46454a6599e001) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add `update` command and improve dependency handling

  - Introduced `update` command to synchronize lockfile and update dependencies.
  - Enhanced lockfile handling with `TOMLLockfileRepository` and `LockfileSynchronizer`.
  - Implemented safety policy enforcement for dependency updates, including drift detection and `--force` override.
  - Updated dependency resolution to include commit hashes and explicit dependency lists.
  - Refined installation logic to handle both new and existing dependencies.
  - Added tests for lockfile writing, safety policy, and updated commands.
  - Introduced `@iarna/toml` dependency for TOML handling.

- [`cc46958`](https://github.com/MaximDevoir/ATO/commit/cc4695829dfa298dfda9faba4fed8fd351033f01) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: remove unused CookMaps option from SimpleAutoBuild

- [`8b12b9c`](https://github.com/MaximDevoir/ATO/commit/8b12b9c3192dff8f19998682081a9f05015292d5) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: create-atc-harness

- [`cb63148`](https://github.com/MaximDevoir/ATO/commit/cb631486b4e4cddf13ab4b2e2911f9fce4dc6f4d) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Implemented the `SimpleAutoBuild` flow

- [`4d5f7cd`](https://github.com/MaximDevoir/ATO/commit/4d5f7cd51f9220cbec8867051b549613a7e004b7) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: rename to uapkg

- [`62953c4`](https://github.com/MaximDevoir/ATO/commit/62953c46c0fccda58a39913fe06cbae95a31f381) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: CLI entry

- [`1c56e0b`](https://github.com/MaximDevoir/ATO/commit/1c56e0b0ce4ce3745c329f201d1bc3ac2fafdd00) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Add postinstall framework for plugin customization in uapkg

- [`467e05c`](https://github.com/MaximDevoir/ATO/commit/467e05c737aa1ff51fc3c7750f72810673369135) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: enhance project harnessing and dependency management

- [`ff93eb2`](https://github.com/MaximDevoir/ATO/commit/ff93eb234d4861a686bbeb525df577c0a5c1525f) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add support for Git tag references in harness creation

- [`7d9cd65`](https://github.com/MaximDevoir/ATO/commit/7d9cd65d818aecb6409d3ba9fa21d3dd1ce43a30) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - # New Package: `@uapkg/diagnostics`

  **Location:** `packages/uapkg-diagnostics/`

  Provides structured, throw-free error handling across the `uapkg` monorepo.

  ***

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

  ***

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

  ***

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

  ***

  ## `@uapkg/pack`

  - `PackService.pack()` → `Promise<Result<PackResult>>`
  - `FileCrawler.collect()` → `Result<CollectedFile[]>`
  - `PluginRootResolver.resolve()` → `Result<ResolvedRoots>`
  - `PackManifestReader.read()` → `Result<PackManifest>`

  ***

  ## CLI

  - `ConfigCommand`

    - Handles `Result` from config operations
    - Returns exit code `1` on failure
    - Prints diagnostics

  - `PackCommand`
    - Handles `Result` from `pack()`
    - Logs diagnostics on failure

  ***

  # Tests

  - `diagnostics.test.ts`
    Covers `Result`, `DiagnosticBag`, and helpers

  - `config-instance.test.ts`
    Updated for nullable `getWithOrigin`

  - `pack-service.test.ts`
    Unwraps `Result` before accessing values

- [`ced0752`](https://github.com/MaximDevoir/ATO/commit/ced075238a8eec8aa37740d5aef347393b21ef23) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - ato: fix process shutdown tracking

- [`23d234f`](https://github.com/MaximDevoir/ATO/commit/23d234f18f7b9d7869977d2ccbe0f9d61018a514) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add `EngineAssociationResolver` module for Unreal Engine directory resolution

- [`7eb25bc`](https://github.com/MaximDevoir/ATO/commit/7eb25bcf841b17218aa2781befd48de737d82ea9) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - ## What Changed

  ### 1) `uapkg pack` improvements

  - Added pack-time exclusion of generated artifacts:
    - excludes `*.integrity`
    - excludes paired non-`.integrity` artifact
    - excludes current output archive path (and its `.integrity`) when inside plugin root
  - Added hard diagnostic failure when no `*.uplugin` descriptor exists.
  - Routed `uapkg pack` command failures through diagnostics reporter/formatter instead of raw log strings.

  ### 2) Diagnostics emit policy + dedupe

  - Extended base diagnostic model with emit metadata:
    - `emitPolicy: 'always' | 'once'`
    - `emitFingerprint`
  - Added reporter-side dedupe component and integrated it into `DiagnosticReporter`.
  - Dedupe state is process-wide (static) so "once" holds across reporter instances in one CLI lifetime.
  - Applied `emitPolicy: 'once'` to:
    - `REGISTRY_UNREACHABLE` (fingerprinted by registry name + URL)
    - `CONFIG_UNRESOLVED_DEFAULT_REGISTRY` (fingerprinted by registry name)

  ### 3) Registry singleton behavior

  - `RegistryCore` now uses a process-wide static registry pool so the same logical registry instance is reused across
    core instances.

  ### 4) Registry UX and command support

  - Improved `REGISTRY_NOT_FOUND` hint with actionable multiline setup guidance.
  - Added new CLI command: `uapkg registry`
    - `add`, `remove`, `list`, `use`
    - supports `--local` / `--global`
    - supports `--branch` / `--tag` / `--rev`
    - wraps `@uapkg/config` operations (no duplicate config logic)
  - `registry add` now writes `ref` atomically to avoid partial-object validation failures.

  ### 5) `config set` usability + tolerant config loading

  - `config set` now accepts scalar values (not JSON-only).
  - Added path-aware scalar parser for booleans/numbers/enums.
  - Added leaf-path enforcement for CLI `config set` (object-level writes rejected in CLI).
  - Added missing valid config paths and leaf-path helper.
  - Added full diagnostics-based tolerant config read/merge/resolve flow:
    - malformed JSON and type mismatches become diagnostics
    - unknown keys become diagnostics
    - no raw schema stack traces for recoverable issues
  - Split semantic validation out of base schema (`CONFIG_UNRESOLVED_DEFAULT_REGISTRY` etc).
  - Added deep-partial write schema support for `registries.*` so leaf updates like:
    - `registries.company.ref.type`
    - `registries.company.ref.value`
      work even when creating paths incrementally.

  ### 6) Diagnostics family/formatter additions for config

  - Added config diagnostic family and formatter/ink rendering support:
    - `CONFIG_INVALID_JSON`
    - `CONFIG_TYPE_MISMATCH`
    - `CONFIG_UNKNOWN_KEY`
    - `CONFIG_UNRESOLVED_DEFAULT_REGISTRY`
    - `CONFIG_INVALID_VALUE`
  - Wired into default formatter maps and ink component maps.

  ### 7) Runtime Ink stability fix

  - Fixed runtime `React is not defined` crashes in diagnostics ink views/components by adding runtime React imports in
    TSX files using JSX.

- [`eca2115`](https://github.com/MaximDevoir/ATO/commit/eca2115e4da38632f174474f1435ec56d007736c) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: add auto-generated comment to BuildGraph XML in SimpleAutoBuild

- [`3b9d01a`](https://github.com/MaximDevoir/ATO/commit/3b9d01afb678d003809e92f6457c5c704b4a4f0e) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - release patch bump

- [`0bb07e6`](https://github.com/MaximDevoir/ATO/commit/0bb07e62abe70d716019a5089650f829c380a44b) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add @uapkg/config and @uapkg/log

## 1.1.2

### Patch Changes

- [`82dd28d`](https://github.com/MaximDevoir/ATO/commit/82dd28da0d4a7ec72ad3ad698a614d1d853af530) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - bump changes

## 1.1.1

### Patch Changes

- [`5ba087c`](https://github.com/MaximDevoir/ATO/commit/5ba087ce1d856377e643b1d968e55f60f0bc4cd1) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - bump changes

## 1.1.0

### Minor Changes

- [`a677976`](https://github.com/MaximDevoir/ATO/commit/a677976f46169e190c768c6ee3fe9e9de5d0771c) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - change bump
