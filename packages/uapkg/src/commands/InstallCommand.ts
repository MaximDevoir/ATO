import type { Diagnostic } from '@uapkg/diagnostics';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import { InstallProgressReporter } from '../reporting/InstallProgressReporter.js';
import type { Command } from './Command.js';
import { PostinstallCandidateBuilder } from './PostinstallCandidateBuilder.js';

export interface InstallCommandOptions {
  readonly force: boolean;
  readonly frozen: boolean;
  readonly dryRun: boolean;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg install` — resolve → plan → download/extract/remove → postinstall.
 *
 * Pipeline (never throws; errors become diagnostics):
 *
 *   1. Read manifest + previous lockfile (best-effort).
 *   2. `PackageManifest.install({ frozen })` → writes a fresh lockfile.
 *   3. `Installer.execute(...)` → executes the install plan.
 *   4. Consume installer's status stream in parallel via `InstallProgressReporter`.
 *   5. On success (non-dryRun), `PostinstallOrchestrator.run()` for added/updated plugins.
 *   6. Report summary + diagnostics.
 *
 * `--force` and `--frozen` are mutually exclusive; the parser layer enforces this.
 */
export class InstallCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: InstallCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const pm = this.root.packageManifest;

    const manifestResult = await pm.readManifest();
    if (!manifestResult.ok) return this.fail(manifestResult.diagnostics);
    const manifest = manifestResult.value;

    const previousLockfileResult = await pm.readLockfile();
    const previousLockfile = previousLockfileResult.ok ? previousLockfileResult.value : null;

    const installResult = await pm.install({ frozen: this.options.frozen });
    if (!installResult.ok) return this.fail(installResult.diagnostics);
    const lockfile = installResult.value;

    const progress = new InstallProgressReporter();
    const consumer = progress.consume(this.root.installer.getStatusStream());

    const executeResult = await this.root.installer.execute(lockfile, previousLockfile, {
      manifestRoot: this.root.cwd,
      force: this.options.force,
      dryRun: this.options.dryRun,
    });
    await consumer;

    if (!executeResult.ok) return this.fail(executeResult.diagnostics);
    const plan = executeResult.value;

    const builder = new PostinstallCandidateBuilder();
    const candidates = builder.build(this.root, plan, lockfile);
    const manifestType = builder.resolveManifestType(manifest);

    let postDiagnostics: readonly Diagnostic[] = [];
    if (!this.options.dryRun && candidates.length > 0) {
      const postResult = await this.root.postinstall.run({
        projectRoot: this.root.cwd,
        manifestType,
        candidates,
      });
      postDiagnostics = postResult.diagnostics;
      if (!postResult.ok) return this.fail([...executeResult.diagnostics, ...postResult.diagnostics]);
    }

    if (this.options.outputFormat === 'json') {
      this.root.json.emit({
        status: 'ok',
        command: 'install',
        data: { plan: plan.summary },
        diagnostics: [...executeResult.diagnostics, ...postDiagnostics],
      });
      return 0;
    }

    this.root.diagnostics.reportAll([...executeResult.diagnostics, ...postDiagnostics]);
    progress.renderSummary(plan.summary);
    return 0;
  }

  private fail(diagnostics: readonly Diagnostic[]): number {
    if (this.options.outputFormat === 'json') {
      this.root.json.emit({ status: 'error', command: 'install', diagnostics });
    } else {
      this.root.diagnostics.reportAll(diagnostics);
    }
    return 1;
  }
}

