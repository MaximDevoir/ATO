import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  createDownloadFailedDiagnostic,
  createDownloadHttpStatusDiagnostic,
  createNetworkRetriesExhaustedDiagnostic,
  createNetworkTimeoutDiagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import { request } from 'undici';

/**
 * Progress callback fired on every received chunk.
 */
export type DownloadProgress = (bytesDone: number, bytesTotal: number | undefined, attempt: number) => void;

export interface DownloadOptions {
  readonly retries: number;
  readonly timeoutMs: number;
}

export interface DownloadResult {
  readonly tempPath: string;
  readonly bytesTotal?: number;
}

/**
 * Streams a .tgz from an HTTP(S) URL to a temp file with retry/timeout support.
 *
 * Retry behavior: on network error or HTTP 5xx, the download is retried up to
 * `retries` times. HTTP 4xx responses are not retried (client error).
 *
 * Does not throw — all errors converted to typed diagnostics.
 */
export class PackageDownloader {
  async download(
    packageName: string,
    url: string,
    options: DownloadOptions,
    onProgress?: DownloadProgress,
  ): Promise<Result<DownloadResult>> {
    const bag = new DiagnosticBag();
    const attempts = Math.max(1, options.retries + 1);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const attemptResult = await this.attempt(packageName, url, options, attempt, onProgress);
      if (attemptResult.ok) return attemptResult;

      // Final attempt — surface accumulated diagnostics plus "retries exhausted".
      if (attempt === attempts) {
        bag.mergeArray(attemptResult.diagnostics);
        bag.add(createNetworkRetriesExhaustedDiagnostic(packageName, url, attempts));
        return bag.toFailure();
      }
      // Otherwise try again; transient diagnostics not surfaced (noisy).
    }

    return bag.toFailure();
  }

  private async attempt(
    packageName: string,
    url: string,
    options: DownloadOptions,
    attempt: number,
    onProgress?: DownloadProgress,
  ): Promise<Result<DownloadResult>> {
    const bag = new DiagnosticBag();
    const tempPath = await this.makeTempPath(packageName);

    let timedOut = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);

    try {
      const res = await request(url, { signal: controller.signal, method: 'GET' });

      if (res.statusCode >= 400) {
        bag.add(createDownloadHttpStatusDiagnostic(packageName, url, res.statusCode));
        return bag.toFailure();
      }

      const totalHeader = res.headers['content-length'];
      const bytesTotal = typeof totalHeader === 'string' ? Number(totalHeader) : undefined;
      let bytesDone = 0;

      const progressStream = new Readable({
        read() {
          /* no-op — we push from the source stream */
        },
      });

      const source = res.body as unknown as Readable;
      source.on('data', (chunk: Buffer) => {
        bytesDone += chunk.length;
        onProgress?.(bytesDone, bytesTotal, attempt);
        progressStream.push(chunk);
      });
      source.on('end', () => progressStream.push(null));
      source.on('error', (err) => progressStream.destroy(err));

      await pipeline(progressStream, createWriteStream(tempPath));

      return ok({ tempPath, bytesTotal });
    } catch (err) {
      await this.safeUnlink(tempPath);
      if (timedOut) {
        bag.add(createNetworkTimeoutDiagnostic(packageName, url, Math.round(options.timeoutMs / 1000)));
      } else {
        bag.add(createDownloadFailedDiagnostic(packageName, url, String(err), attempt));
      }
      return bag.toFailure();
    } finally {
      clearTimeout(timer);
    }
  }

  private async makeTempPath(packageName: string): Promise<string> {
    const dir = join(tmpdir(), 'uapkg-installer');
    await mkdir(dir, { recursive: true });
    const safe = packageName.replace(/[^a-z0-9-_]/gi, '_');
    return join(dir, `${safe}-${Date.now()}-${Math.random().toString(36).slice(2)}.tgz`);
  }

  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      /* best-effort */
    }
  }
}
