# uapkg

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

- [`4d5f7cd`](https://github.com/MaximDevoir/ATO/commit/4d5f7cd51f9220cbec8867051b549613a7e004b7) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: rename to uapkg

- [`1c56e0b`](https://github.com/MaximDevoir/ATO/commit/1c56e0b0ce4ce3745c329f201d1bc3ac2fafdd00) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Add postinstall framework for plugin customization in uapkg

- [`467e05c`](https://github.com/MaximDevoir/ATO/commit/467e05c737aa1ff51fc3c7750f72810673369135) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: enhance project harnessing and dependency management
