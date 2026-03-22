import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { finished } from 'node:stream/promises';
import util from 'node:util';

export type ATOConsoleLevel = 'log' | 'warn' | 'error';

export interface ATORunOutput {
  readonly filePath: string;
  emitLine(line: string, options?: { level?: ATOConsoleLevel; echo?: boolean }): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  close(): Promise<void>;
}

const MAX_LOG_FILES = 10;

function sanitizePathSegment(value: string) {
  return value.replaceAll(/[<>:"/\\|?*]+/g, '_').trim() || 'ATO';
}

function formatTimestampFileSegment(date: Date) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function formatConsoleArgs(args: unknown[]) {
  return util.formatWithOptions({ colors: false, depth: null }, ...args);
}

function writeConsoleLine(level: ATOConsoleLevel, line: string) {
  switch (level) {
    case 'error':
      console.error(line);
      return;
    case 'warn':
      console.warn(line);
      return;
    default:
      console.log(line);
  }
}

async function pruneOldLogs(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.log'))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const details = await stat(filePath);
        return {
          filePath,
          modifiedAtMs: details.mtimeMs,
          name: entry.name,
        };
      }),
  );

  files.sort((left, right) => {
    if (left.modifiedAtMs !== right.modifiedAtMs) {
      return right.modifiedAtMs - left.modifiedAtMs;
    }

    return right.name.localeCompare(left.name);
  });

  for (const staleFile of files.slice(MAX_LOG_FILES - 1)) {
    await unlink(staleFile.filePath);
  }
}

class FileBackedATORunOutput implements ATORunOutput {
  private readonly stream;
  private closed = false;

  constructor(public readonly filePath: string) {
    this.stream = createWriteStream(filePath, { encoding: 'utf8' });
  }

  emitLine(line: string, options: { level?: ATOConsoleLevel; echo?: boolean } = {}) {
    const level = options.level ?? 'log';
    this.stream.write(`${line}\n`);
    if (options.echo !== false) {
      writeConsoleLine(level, line);
    }
  }

  log(...args: unknown[]) {
    this.emitLine(formatConsoleArgs(args), { level: 'log' });
  }

  warn(...args: unknown[]) {
    this.emitLine(formatConsoleArgs(args), { level: 'warn' });
  }

  error(...args: unknown[]) {
    this.emitLine(formatConsoleArgs(args), { level: 'error' });
  }

  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.stream.end();
    await finished(this.stream);
  }
}

export async function createATORunOutput(projectRoot: string, label: string): Promise<ATORunOutput> {
  const directory = path.join(projectRoot, 'Saved', 'Logs', 'ATO', sanitizePathSegment(label));
  await mkdir(directory, { recursive: true });
  await pruneOldLogs(directory);

  const filePath = path.join(
    directory,
    `${formatTimestampFileSegment(new Date())}-${sanitizePathSegment(label)}-${process.pid}.log`,
  );

  return new FileBackedATORunOutput(filePath);
}
