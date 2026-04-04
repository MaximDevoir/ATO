# @maximdevoir/engine-association-resolver

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

- [`8b12b9c`](https://github.com/MaximDevoir/ATO/commit/8b12b9c3192dff8f19998682081a9f05015292d5) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: create-atc-harness

- [`4d5f7cd`](https://github.com/MaximDevoir/ATO/commit/4d5f7cd51f9220cbec8867051b549613a7e004b7) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: rename to uapkg

- [`62953c4`](https://github.com/MaximDevoir/ATO/commit/62953c46c0fccda58a39913fe06cbae95a31f381) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: CLI entry

- [`1c56e0b`](https://github.com/MaximDevoir/ATO/commit/1c56e0b0ce4ce3745c329f201d1bc3ac2fafdd00) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Add postinstall framework for plugin customization in uapkg

- [`467e05c`](https://github.com/MaximDevoir/ATO/commit/467e05c737aa1ff51fc3c7750f72810673369135) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: enhance project harnessing and dependency management

- [`ff93eb2`](https://github.com/MaximDevoir/ATO/commit/ff93eb234d4861a686bbeb525df577c0a5c1525f) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add support for Git tag references in harness creation

- [`23d234f`](https://github.com/MaximDevoir/ATO/commit/23d234f18f7b9d7869977d2ccbe0f9d61018a514) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add `EngineAssociationResolver` module for Unreal Engine directory resolution
