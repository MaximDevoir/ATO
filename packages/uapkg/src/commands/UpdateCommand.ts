import { parsePackageSpec } from '@uapkg/common';
import type { PackageName, VersionRange } from '@uapkg/common-schema';
import {
  type Diagnostic,
  createInvalidPackageSpecDiagnostic,
  createPackageNotFoundDiagnostic,
} from '@uapkg/diagnostics';
import type { Dependency, Manifest } from '@uapkg/package-manifest-schema';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import type { Command } from './Command.js';
import { InstallCommand } from './InstallCommand.js';

export interface UpdateCommandOptions {
  readonly specs: readonly string[];
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly outputFormat: 'text' | 'json';
}

type Bucket = 'dependencies' | 'devDependencies' | 'peerDependencies';

interface LocatedDependency {
  readonly bucket: Bucket;
  readonly registry: Dependency['registry'];
}

/**
 * `uapkg update [specs...]` — re-resolve and re-install.
 *
 * Modes:
 *
 *   * `uapkg update`                             — full update (all packages).
 *   * `uapkg update foo`                         — re-resolve `foo` via the
 *     normal install flow; lockfile diff skips untouched packages.
 *   * `uapkg update foo@^2.0.0`                  — rewrite `foo`'s range in the
 *     manifest (preserving its bucket + registry) then re-install.
 *   * `uapkg update foo@^2 @scope/bar@~1.5`      — array form; each spec is
 *     processed in order before a single install pass.
 *
 * Never throws — errors become diagnostics. Specs that reference unknown
 * packages produce `PACKAGE_NOT_FOUND` against the local manifest.
 */
export class UpdateCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: UpdateCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    if (this.options.specs.length === 0) {
      return this.delegateToInstall();
    }

    const manifestResult = await this.root.packageManifest.readManifest();
    if (!manifestResult.ok) return this.fail(manifestResult.diagnostics);

    const diagnostics: Diagnostic[] = [];
    for (const rawSpec of this.options.specs) {
      const applyResult = await this.applySpec(rawSpec, manifestResult.value);
      if (!applyResult.ok) diagnostics.push(...applyResult.diagnostics);
    }

    if (diagnostics.length > 0) return this.fail(diagnostics);

    return this.delegateToInstall();
  }

  /**
   * Parse a single `<name>[@range]` spec and, if a range is supplied, rewrite
   * the manifest entry preserving its existing bucket + registry. Bare-name
   * specs are a no-op at the manifest level — the subsequent install pass
   * handles the re-resolve.
   */
  private async applySpec(
    rawSpec: string,
    manifest: Manifest,
  ): Promise<{ ok: true } | { ok: false; diagnostics: Diagnostic[] }> {
    const specResult = parsePackageSpec(rawSpec);
    if (!specResult.ok) return { ok: false, diagnostics: [...specResult.diagnostics] };
    const spec = specResult.value;

    if (spec.org) {
      return {
        ok: false,
        diagnostics: [
          createInvalidPackageSpecDiagnostic(
            rawSpec,
            'scoped specifiers (@org/name) are reserved for a future registry iteration',
          ),
        ],
      };
    }

    const located = this.locateDependency(manifest, spec.name as unknown as string);
    if (!located) {
      return {
        ok: false,
        diagnostics: [
          createPackageNotFoundDiagnostic(
            spec.name as unknown as PackageName,
            String(manifest.name),
          ),
        ],
      };
    }

    if (!spec.range) return { ok: true };

    const addResult = await this.root.packageManifest.addDependency(
      spec.name as unknown as string,
      {
        version: spec.range as unknown as VersionRange,
        registry: located.registry,
      },
      { bucket: located.bucket },
    );
    if (!addResult.ok) return { ok: false, diagnostics: [...addResult.diagnostics] };
    return { ok: true };
  }

  /**
   * Find `name` in the manifest buckets, preserving the source-of-truth
   * bucket + registry so `applySpec` doesn't move the dep between buckets.
   */
  private locateDependency(manifest: Manifest, name: string): LocatedDependency | null {
    const order: Bucket[] = ['dependencies', 'devDependencies', 'peerDependencies'];
    for (const bucket of order) {
      const entries = manifest[bucket];
      if (entries && name in entries) {
        return { bucket, registry: entries[name].registry };
      }
    }
    return null;
  }

  private delegateToInstall(): Promise<number> {
    const install = new InstallCommand(this.root, {
      force: this.options.force,
      frozen: false,
      dryRun: this.options.dryRun,
      outputFormat: this.options.outputFormat,
    });
    return install.execute();
  }

  private fail(diagnostics: readonly Diagnostic[]): number {
    if (this.options.outputFormat === 'json') {
      this.root.json.emit({ status: 'error', command: 'update', diagnostics });
    } else {
      this.root.diagnostics.reportAll(diagnostics);
    }
    return 1;
  }
}
