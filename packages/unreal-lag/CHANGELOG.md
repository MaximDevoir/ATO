# @maximdevoir/unreal-lag

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

- [`ced0752`](https://github.com/MaximDevoir/ATO/commit/ced075238a8eec8aa37740d5aef347393b21ef23) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - ato: fix process shutdown tracking

- [`23d234f`](https://github.com/MaximDevoir/ATO/commit/23d234f18f7b9d7869977d2ccbe0f9d61018a514) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - feat: add `EngineAssociationResolver` module for Unreal Engine directory resolution

- [`eca2115`](https://github.com/MaximDevoir/ATO/commit/eca2115e4da38632f174474f1435ec56d007736c) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - chore: add auto-generated comment to BuildGraph XML in SimpleAutoBuild

## 1.1.2

### Patch Changes

- [`82dd28d`](https://github.com/MaximDevoir/ATO/commit/82dd28da0d4a7ec72ad3ad698a614d1d853af530) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - bump changes

## 1.1.1

### Patch Changes

- [`5ba087c`](https://github.com/MaximDevoir/ATO/commit/5ba087ce1d856377e643b1d968e55f60f0bc4cd1) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - bump changes

## 1.1.0

### Minor Changes

- [`a677976`](https://github.com/MaximDevoir/ATO/commit/a677976f46169e190c768c6ee3fe9e9de5d0771c) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - change bump

- [`b37b5f5`](https://github.com/MaximDevoir/ATO/commit/b37b5f5ed11b956191a62705730185353a51cbce) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Add scoped plans test suite

  Introduced test suites to validate reusable plans within different scopes (A, B, and C) in standalone mode. Ensured proper isolation and no plan collisions between scopes, with detailed assertions and logging for task execution. Updated orchestrator and validation logic to include scoped plan tests.

## 1.0.3

### Patch Changes

- [`228aafa`](https://github.com/MaximDevoir/ATO/commit/228aafa0098459c6ddf0b48916735692237d8949) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Switch to OIDC

## 1.0.2

### Patch Changes

- [`5343d89`](https://github.com/MaximDevoir/ATO/commit/5343d892cbdee4f69e52cbdeb4a5943b0cf111a4) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - fix: lowercase names and scope to maximdevoir

## 1.0.1

### Patch Changes

- [`f3a01bd`](https://github.com/MaximDevoir/ATO/commit/f3a01bdf9c5a7016695f512f65081ff50f448f56) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - fix: add release script

## 1.0.0

### Major Changes

- [`d85bfcf`](https://github.com/MaximDevoir/ATO/commit/d85bfcf4ae7ebc995bb659a02eb45bfed52e4f6f) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Initial release of ATO

  ATO is the layer above ATC and it orchestrates ATC sessions, in any configuration, so you can focus on writing tests.

- [`a2b0466`](https://github.com/MaximDevoir/ATO/commit/a2b0466c02d4cec2516de77f38c215cc170b69b3) Thanks [@MaximDevoir](https://github.com/MaximDevoir)! - Switch to node@24
