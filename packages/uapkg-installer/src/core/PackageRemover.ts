import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { InstallPath } from '@uapkg/common-schema';
import { createDiskRemoveFailedDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';

/**
 * Removes a package directory from disk.
 *
 * Scope is always `<manifestRoot>/<installPath>`; we never touch anything
 * outside this tree. Safe against partially-extracted state.
 */
export class PackageRemover {
  async remove(packageName: string, manifestRoot: string, installPath: InstallPath): Promise<Result<void>> {
    const bag = new DiagnosticBag();
    const target = resolve(manifestRoot, installPath);
    try {
      await rm(target, { recursive: true, force: true });
      return ok(undefined);
    } catch (err) {
      bag.add(createDiskRemoveFailedDiagnostic(packageName, installPath as unknown as string, String(err)));
      return bag.toFailure();
    }
  }
}
