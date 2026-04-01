---
"uapm": patch
"@maximdevoir/ati": patch
"@maximdevoir/ato": patch
"@maximdevoir/create-atc-harness": patch
"@maximdevoir/engine-association-resolver": patch
"@maximdevoir/unreal-lag": patch
---

feat: add `update` command and improve dependency handling

- Introduced `update` command to synchronize lockfile and update dependencies.
- Enhanced lockfile handling with `TOMLLockfileRepository` and `LockfileSynchronizer`.
- Implemented safety policy enforcement for dependency updates, including drift detection and `--force` override.
- Updated dependency resolution to include commit hashes and explicit dependency lists.
- Refined installation logic to handle both new and existing dependencies.
- Added tests for lockfile writing, safety policy, and updated commands.
- Introduced `@iarna/toml` dependency for TOML handling.
