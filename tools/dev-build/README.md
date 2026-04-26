# dev-build tooling

This folder contains local development tooling executed directly with `tsx`.

## Commands

```json
{
  "build": "tsx tools/dev-build/runDevBuild.ts build",
  "build:link": "tsx tools/dev-build/runDevBuild.ts link",
  "build:watch": "tsx tools/dev-build/runDevBuild.ts watch",
  "build:unlink": "tsx tools/dev-build/runDevBuild.ts unlink",
  "build:status": "tsx tools/dev-build/runDevBuild.ts status"
}
```

## Behavior

- `build`: normal monorepo build via Nx.
- `build:link`: build `uapkg`, globally link only `packages/uapkg`, and write global command shims in `pnpm bin --global` so `uapkg` works from any terminal.
- `build:watch`: watch only `uapkg` with `--includeDependentProjects`, then run `build:link` on changes.
- `build:unlink`: remove the active global dev link and restore only safe previous state.
- `build:status`: inspect snapshot state, current global state, global-bin/path health, and binary resolution.

Snapshot file:

- `tools/dev-build/.state/global-uapkg-state.json`

## Force options

- `pnpm run build:link -- --force`
- `pnpm run build:unlink -- --force`

`--force` allows overriding conservative defaults, but external dev links are still never auto-restored.

## Running from Anywhere

After `build:link`, `uapkg` is expected to resolve from the pnpm global bin directory, not from the monorepo root.

Quick checks:

```powershell
pnpm run build:link
pnpm run build:status
pnpm bin --global
where.exe uapkg
```

If `build:status` shows `Global Bin In PATH: no`, add the printed global bin directory to your user `PATH` and open a new terminal.

## Do Not

- Do not globally link `@uapkg/config`, `@uapkg/pack`, `@uapkg/diagnostics`, or any other internal packages.
- Do not use repo-local `.pnpm-global`; use real pnpm global state.
- Do not overwrite the restore snapshot on repeated `build:link` unless `--force` is explicitly passed.
- Do not use `pnpm unlink --global`; use `pnpm remove --global`.
- Do not manually maintain package lists that Nx can derive.

## CI Rule

CI must use normal install/build/typecheck/test flows only.

CI must not run:

- `build:link`
- `build:watch`
- `build:unlink`

## Acceptance Tests

- `pnpm run build:link` globally links `uapkg` to `packages/uapkg`.
- `pnpm list -g --depth 0` shows `uapkg@link:<workspace>/packages/uapkg`.
- `where.exe uapkg` resolves from `pnpm bin --global` after linking.
- Running `build:link` twice does not overwrite the original snapshot.
- `pnpm run build:unlink` restores published `uapkg@<version>` if that was the prior state.
- If prior state was another dev link, unlink removes current link but does not restore the external link.
- `pnpm run build:watch` does not contain a manually maintained project list.
- CI typecheck still passes without global links.

