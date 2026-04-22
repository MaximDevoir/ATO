import type { InstallPath, PackageName } from '@uapkg/common-schema';
import { createSafetyPathNotProjectManifestDiagnostic, type DiagnosticBag } from '@uapkg/diagnostics';
import type { Dependency, Manifest } from '@uapkg/package-manifest-schema';

/**
 * Result of resolving the final install path for a single dependency.
 */
export interface ResolvedInstallPath {
  readonly name: PackageName;
  readonly path: InstallPath;
  /** True when the dependency's declared `path` override was ignored. */
  readonly overridden: boolean;
}

/**
 * Decides where each dependency is installed, relative to the manifest root.
 *
 * Rules:
 *  - A dependency's `path` override is honored **only** on project-kind manifests.
 *  - On plugin-kind manifests, any declared `path` is ignored and a
 *    `SAFETY_PATH_NOT_PROJECT_MANIFEST` warning is emitted. The default
 *    `Plugins/<name>` location is used.
 *  - Absent overrides, every dependency installs to `Plugins/<name>`.
 */
export class InstallPathResolver {
  /**
   * Resolve the install path for a single dependency.
   *
   * Writes at most one warning to `bag`.
   */
  resolve(manifest: Manifest, depName: string, dep: Dependency, bag: DiagnosticBag): ResolvedInstallPath {
    const fallback = this.defaultPathFor(depName);

    if (dep.path === undefined) {
      return { name: depName as PackageName, path: fallback, overridden: false };
    }

    if (manifest.kind !== 'project') {
      bag.add(createSafetyPathNotProjectManifestDiagnostic(manifest.name, depName, dep.path, fallback));
      return { name: depName as PackageName, path: fallback, overridden: true };
    }

    return { name: depName as PackageName, path: dep.path, overridden: false };
  }

  /** Default install location: `Plugins/<name>`. */
  defaultPathFor(depName: string): InstallPath {
    return `Plugins/${depName}` as InstallPath;
  }
}
