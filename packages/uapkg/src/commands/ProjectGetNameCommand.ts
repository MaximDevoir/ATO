import { ManifestReader } from '@uapkg/package-manifest';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';

/**
 * Options for {@link ProjectGetNameCommand}. Reserved for future expansion
 * (e.g. alternate output format); today the command is fully parameterized
 * by {@link CompositionRoot}.
 */
export type ProjectGetNameCommandOptions = Record<string, never>;

// ---------------------------------------------------------------------------
// ProjectGetNameCommand — prints the `name` field of the current project
// manifest to stdout. Fails with exit code 1 if the manifest is absent, not
// a project, or invalid. Intended for shell wrapping in CI scripts.
// ---------------------------------------------------------------------------

export class ProjectGetNameCommand implements Command {
  public constructor(private readonly root: CompositionRoot) {}

  public async execute(): Promise<number> {
    const result = await new ManifestReader().read(this.root.cwd);
    if (!result.ok) {
      this.root.diagnostics.reportAll(result.diagnostics);
      return 1;
    }
    if (result.value.kind !== 'project') {
      process.stderr.write(`[uapkg] Expected manifest kind 'project', received '${result.value.kind}'\n`);
      return 1;
    }
    process.stdout.write(`${String(result.value.name)}\n`);
    return 0;
  }
}
