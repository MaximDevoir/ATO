import type { Diagnostic } from '@uapkg/diagnostics';
import { parsePackageSpec } from '@uapkg/common';
import type { VersionRange } from '@uapkg/common-schema';
import { RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import type { Dependency } from '@uapkg/package-manifest-schema';
import type { CompositionRoot } from '../app/CompositionRoot.js';
import { InstallProgressReporter } from '../reporting/InstallProgressReporter.js';
import type { Command } from './Command.js';
import { InstallCommand } from './InstallCommand.js';

export interface AddCommandOptions {
  readonly spec: string;
  readonly pin: boolean;
  readonly dev: boolean;
  readonly registry?: string;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly outputFormat: 'text' | 'json';
}

/**
 * `uapkg add <@Org/Name@range>` — parse the spec, mutate the manifest,
 * delegate to `InstallCommand` for the resolve/install/postinstall pipeline.
 *
 * This command is deliberately thin — it is a manifest-mutation shim around
 * `install`. All resolution/installation invariants live one level down.
 */
export class AddCommand implements Command {
  public constructor(
    private readonly root: CompositionRoot,
    private readonly options: AddCommandOptions,
  ) {}

  public async execute(): Promise<number> {
    const specResult = parsePackageSpec(this.options.spec);
    if (!specResult.ok) return this.fail(specResult.diagnostics);
    const spec = specResult.value;

    const registryName = this.options.registry ?? this.root.config.get('registry');
    const registryParsed = RegistryNameSchema.safeParse(registryName ?? 'default');
    if (!registryParsed.success) {
      return this.fail([
        {
          level: 'error',
          code: 'INVALID_ARGS',
          message: 'Registry name is invalid.',
          data: { value: registryName },
        } as unknown as Diagnostic,
      ]);
    }

    const rangeStr = spec.range ?? ('*' as unknown as VersionRange);
    const rangeParsed = VersionRangeSchema.safeParse(rangeStr);
    if (!rangeParsed.success) {
      return this.fail([
        {
          level: 'error',
          code: 'INVALID_VERSION_RANGE',
          message: `Invalid version range "${rangeStr}".`,
          data: { input: this.options.spec, range: rangeStr },
        } as unknown as Diagnostic,
      ]);
    }

    const dep: Dependency = {
      version: rangeParsed.data,
      registry: registryParsed.data,
    };
    const addResult = await this.root.packageManifest.addDependency(
      spec.name as unknown as string,
      dep,
      { bucket: this.options.dev ? 'devDependencies' : 'dependencies', pin: this.options.pin },
    );
    if (!addResult.ok) return this.fail(addResult.diagnostics);

    // Delegate to Install for the resolve/execute/postinstall pipeline.
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
      this.root.json.emit({ status: 'error', command: 'add', diagnostics });
    } else {
      this.root.diagnostics.reportAll(diagnostics);
    }
    return 1;
  }
}

// Silence an unused-import warning in strict TS setups; retained for type clarity.
void InstallProgressReporter;


