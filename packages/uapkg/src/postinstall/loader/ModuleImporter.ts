import fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPostinstallLoadFailedDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

export type ModuleSource =
  | { readonly kind: 'file'; readonly path: string }
  /** ESM source already transpiled by {@link EsbuildTranspiler}. */
  | { readonly kind: 'transpiled'; readonly code: string; readonly originalPath: string };

/**
 * Imports a postinstall module.
 *
 * For `.js`/`.mjs` files we use the file URL directly so relative imports and
 * `node_modules` resolution work.
 *
 * For transpiled `.ts` code we write to a sibling temp file next to the
 * original entry — data: URLs cannot resolve relative specifiers — and delete
 * it on best-effort basis after import. The file lives in the OS tmp dir
 * keyed by a timestamp+pid, avoiding collisions across concurrent installs.
 */
export class ModuleImporter {
  public async import(packageName: string, source: ModuleSource): Promise<Result<unknown>> {
    if (source.kind === 'file') {
      return this.importFileUrl(packageName, source.path, source.path);
    }
    const tmpFile = this.createTempFile(source.originalPath, source.code);
    try {
      return await this.importFileUrl(packageName, tmpFile, source.originalPath);
    } finally {
      this.safeUnlink(tmpFile);
    }
  }

  private async importFileUrl(packageName: string, filePath: string, reportedPath: string): Promise<Result<unknown>> {
    try {
      // Cache-bust with a query parameter so repeated postinstall runs in the
      // same process (e.g. tests) always reload the latest bytes on disk.
      const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const moduleValue = await import(url);
      return ok(moduleValue);
    } catch (error) {
      return fail([
        createPostinstallLoadFailedDiagnostic(
          packageName,
          reportedPath,
          error instanceof Error ? error.message : String(error),
        ),
      ]);
    }
  }

  private createTempFile(originalPath: string, code: string): string {
    const base = path.basename(originalPath, path.extname(originalPath));
    const fileName = `uapkg-postinstall-${base}-${process.pid}-${Date.now()}.mjs`;
    const tmpFile = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tmpFile, code, 'utf-8');
    return tmpFile;
  }

  private safeUnlink(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Best-effort cleanup; OS tmp dir is rotated anyway.
    }
  }
}
