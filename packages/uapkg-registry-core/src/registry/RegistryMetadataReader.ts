import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createCacheReadErrorDiagnostic,
  createIoErrorDiagnostic,
  DiagnosticBag,
  fail,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { RegistryMetadata } from '../contracts/RegistryCoreTypes.js';
import { getRegistryMetadataPath } from '../paths/RegistryPaths.js';

/**
 * Read and write `registry.json` metadata for a local registry cache.
 */
export class RegistryMetadataReader {
  constructor(private readonly shortId: string) {}

  /** Read registry.json from cache. */
  async read(): Promise<Result<RegistryMetadata>> {
    const metaPath = getRegistryMetadataPath(this.shortId);
    try {
      const raw = await readFile(metaPath, 'utf-8');
      const data = JSON.parse(raw) as RegistryMetadata;
      return ok(data);
    } catch (err) {
      return fail([createCacheReadErrorDiagnostic(metaPath, String(err))]);
    }
  }

  /** Write updated registry.json to cache. */
  async write(metadata: RegistryMetadata): Promise<Result<void>> {
    const metaPath = getRegistryMetadataPath(this.shortId);
    try {
      const dir = metaPath.replace(/[/\\][^/\\]+$/, '');
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
      return ok(undefined);
    } catch (err) {
      return fail([createIoErrorDiagnostic(metaPath, String(err))]);
    }
  }

  /** Check whether registry.json exists in cache. */
  exists(): boolean {
    return existsSync(getRegistryMetadataPath(this.shortId));
  }
}
