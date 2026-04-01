# create-atc-harness

Create an Unreal host project (harness) from a plugin `atc.json` manifest.

## What it does

- Reads `atc.json` from a local path/folder or a Git repository.
- Validates only the required manifest keys:
  - `type` must be `"plugin"`
  - `harness` must be a string
- Creates a harness project with the selected harness creator.
- Installs/hoists the plugin into the created harness project.

## CLI

`create-atc-harness <manifestString> [outputRootDirectory] [options]`

### Positional args

- `manifestString`
  - Path to `atc.json`
  - Path to folder containing `atc.json`
  - Git URL to repo with `atc.json` at repo root
- `outputRootDirectory` (optional)
  - Directory where the harness project is created
  - If omitted, defaults to:
    - `${atcJsonName}Harness` when `atc.json.name` is present
    - `${upluginFileName}Harness` when `name` is missing

### Options

- `--harness=<HarnessCreatorName>`
  - Force a specific harness creator by `HarnessCreator.name` (for example `EngineTemplate`, `Git`)
- `--engineAssociation=<value>`
  - Engine association key, engine path, or `first`

## TypeScript-only usage

This package is source-only TypeScript, so run it through `tsx`.

### From this package directory

```bash
pnpm run create-atc-harness -- "<manifestString>" "<outputRootDirectory>" [options]
```

Example:

```bash
pnpm run create-atc-harness -- "./MyPlugin/atc.json" "./HarnessProject" --harness=EngineTemplate --engineAssociation=first
```

Example (auto output directory name):

```bash
pnpm run create-atc-harness -- "./MyPlugin/atc.json"
```

### Direct `tsx` invocation

```bash
npx tsx src/cli.ts "<manifestString>" "<outputRootDirectory>" [options]
```

### From monorepo root (pnpm filter)

```bash
pnpm --filter @maximdevoir/create-atc-harness run create-atc-harness -- "<manifestString>" "<outputRootDirectory>" [options]
```

## Notes

- In CI, engine resolution is strict and fails early when required values are missing.
- For Git-based harnesses/manifests, Git LFS is used when `.gitattributes` contains `filter=lfs`.
