import type { WriteStream } from 'node:fs';
import { createWriteStream, mkdirSync } from 'node:fs';
import { rename, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { ATIContext, IATIConsumer } from '../ATIConsumer';
import type { ATCEvent } from '../ATIEvents';

export type NDJSONConsumerOptions = {
  directory: string;
  fileName?: string;
  maxFileSizeBytes?: number;
};

export class NDJSONConsumer implements IATIConsumer {
  readonly id = 'ndjson';
  private stream?: WriteStream;
  private activeFilePath = '';
  private partIndex = 0;

  constructor(private readonly options: NDJSONConsumerOptions) {}

  async onStart(ctx: ATIContext) {
    mkdirSync(this.options.directory, { recursive: true });
    this.partIndex = 0;
    this.activeFilePath = path.join(this.options.directory, this.resolveFileName(ctx));
    this.stream = createWriteStream(this.activeFilePath, { flags: 'a' });
  }

  async onEvent(event: ATCEvent) {
    if (!this.stream) {
      throw new Error('NDJSON consumer received an event before onStart');
    }

    const line = `${JSON.stringify(event)}\n`;
    await this.rotateIfNeeded(Buffer.byteLength(line, 'utf8'));

    await new Promise<void>((resolve, reject) => {
      this.stream?.write(line, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async dispose() {
    if (!this.stream) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.stream?.end(() => resolve());
    });
    this.stream = undefined;
  }

  private resolveFileName(ctx: ATIContext) {
    if (this.options.fileName) {
      return this.options.fileName;
    }

    return `session_${ctx.sessionId}.ndjson`;
  }

  private async rotateIfNeeded(nextWriteSizeBytes: number) {
    if (!this.stream || !this.options.maxFileSizeBytes || !this.activeFilePath) {
      return;
    }

    let currentSize: number;
    try {
      currentSize = (await stat(this.activeFilePath)).size;
    } catch {
      currentSize = 0;
    }

    if (currentSize + nextWriteSizeBytes <= this.options.maxFileSizeBytes) {
      return;
    }

    await this.dispose();
    const rotatedPath = this.activeFilePath.replace(/\.ndjson$/i, `.${this.partIndex}.ndjson`);
    try {
      await rename(this.activeFilePath, rotatedPath);
    } catch {
      // noop if the active file has already been moved or removed.
    }
    this.partIndex += 1;
    this.stream = createWriteStream(this.activeFilePath, { flags: 'a' });
  }
}
