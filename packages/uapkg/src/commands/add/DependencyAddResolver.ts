import type { PackageSpec, VersionRange } from '@uapkg/common-schema';
import { RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import { createRegistryNotFoundDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { Dependency } from '@uapkg/package-manifest-schema';
import type { CompositionRoot } from '../../app/CompositionRoot.js';

export interface ResolvedAddDependency {
  readonly dependency: Dependency;
  readonly resolvedVersion: string;
}

/**
 * Resolves an `add` request against the selected registry before mutating the
 * manifest, ensuring package and version existence.
 */
export class DependencyAddResolver {
  public constructor(private readonly root: CompositionRoot) {}

  public async resolve(spec: PackageSpec, registryNameInput?: string): Promise<Result<ResolvedAddDependency>> {
    const registryCandidate = registryNameInput ?? (this.root.config.get('registry') as string | null) ?? 'default';
    const registryNameResult = RegistryNameSchema.safeParse(registryCandidate);
    if (!registryNameResult.success) {
      return fail([createRegistryNotFoundDiagnostic(registryCandidate)]);
    }
    const registryName = registryNameResult.data;

    const registryResult = this.root.registryCore.getOrCreateRegistry(registryName);
    if (!registryResult.ok) return registryResult as Result<never>;

    const requestedRange = spec.range ?? ('*' as unknown as VersionRange);
    const resolution = await registryResult.value.resolvePackage(
      spec.name as unknown as string,
      requestedRange,
      registryName,
    );
    if (!resolution.ok) return resolution as Result<never>;

    const dependencyRange = spec.range ?? VersionRangeSchema.parse(`^${resolution.value.version}`);

    return ok(
      {
        dependency: {
          version: dependencyRange,
          registry: registryName,
        },
        resolvedVersion: resolution.value.version,
      },
      resolution.diagnostics,
    );
  }
}
