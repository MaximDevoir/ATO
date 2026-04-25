---
"@uapkg/diagnostics-format": patch
"@uapkg/registry-core": patch
"@uapkg/diagnostics": patch
"@uapkg/config": patch
"@uapkg/pack": patch
"uapkg": patch
"@maximdevoir/ati": patch
"@maximdevoir/ato": patch
"@maximdevoir/create-atc-harness": patch
"@maximdevoir/engine-association-resolver": patch
"@uapkg/common": patch
"@uapkg/common-schema": patch
"@uapkg/installer": patch
"@uapkg/log": patch
"@uapkg/package-manifest": patch
"@uapkg/package-manifest-schema": patch
"@uapkg/registry-schema": patch
"@maximdevoir/unreal-lag": patch
---

## What Changed

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
