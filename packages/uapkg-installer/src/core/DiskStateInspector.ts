import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { safeJsonParse } from '@uapkg/common';
import type { InstallPath, PackageName, PackageVersion } from '@uapkg/common-schema';
import { ok, type Result } from '@uapkg/diagnostics';
import { type Lockfile, ManifestSchema } from '@uapkg/package-manifest-schema';

/**
 * What we found at a given install path on disk.
 */
export interface DiskStateEntry {
  readonly path: InstallPath;
  readonly exists: boolean;
  readonly hasManifest: boolean;
  readonly installedName?: PackageName;
  readonly installedVersion?: PackageVersion;
}

/**
 * Determines the current on-disk state of every package referenced in a
 * lockfile. Scoped to lockfile entries only — files outside the lockfile's
 * install paths are never touched or enumerated.
 *
 * This is the entry point that makes the installer non-destructive: we only
 * know about paths we already own.
 */
export class DiskStateInspector {
  async inspect(manifestRoot: string, lockfile: Lockfile): Promise<Result<Map<PackageName, DiskStateEntry>>> {
    const result = new Map<PackageName, DiskStateEntry>();

    for (const [pkgName, entry] of Object.entries(lockfile.packages)) {
      const relPath = this.resolveRelPath(pkgName as PackageName, entry);
      const absPath = resolve(manifestRoot, relPath);
      const state = await this.inspectOne(absPath, relPath);
      result.set(pkgName as PackageName, state);
    }

    return ok(result);
  }

  private resolveRelPath(name: PackageName, _entry: unknown): InstallPath {
    // Lockfile entries currently carry no `path` field (future: lockfile
    // will record the resolved install path per-package).
    // Default: `Plugins/<name>`.
    return `Plugins/${name}` as InstallPath;
  }

  private async inspectOne(absPath: string, relPath: InstallPath): Promise<DiskStateEntry> {
    let exists = false;
    try {
      const st = await stat(absPath);
      exists = st.isDirectory();
    } catch {
      exists = false;
    }

    if (!exists) {
      return { path: relPath, exists: false, hasManifest: false };
    }

    const manifestPath = join(absPath, 'uapkg.json');
    let raw: string;
    try {
      raw = await readFile(manifestPath, 'utf-8');
    } catch {
      return { path: relPath, exists: true, hasManifest: false };
    }

    const parsed = safeJsonParse<unknown>(raw, manifestPath);
    if (!parsed.ok) {
      return { path: relPath, exists: true, hasManifest: false };
    }

    const validated = ManifestSchema.safeParse(parsed.value);
    if (!validated.success) {
      return { path: relPath, exists: true, hasManifest: false };
    }

    return {
      path: relPath,
      exists: true,
      hasManifest: true,
      installedName: validated.data.name as PackageName,
      installedVersion: validated.data.version as PackageVersion,
    };
  }
}


