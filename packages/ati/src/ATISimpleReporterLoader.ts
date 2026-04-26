import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import readline from 'node:readline';
import { ATISimpleReporter } from './ATISimpleReporter.js';
import { parseATCEvent } from './validation.js';

export async function loadATISimpleReporterFromNDJSONFile(filePath: string) {
  const reporter = new ATISimpleReporter();
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of reader) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      reporter.addEvent(parseATCEvent(trimmed));
    }
  } finally {
    reader.close();
    stream.close();
  }

  return reporter;
}

export async function findLatestNDJSONFile(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.ndjson'))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const stats = await import('node:fs/promises').then(({ stat }) => stat(filePath));
        return { filePath, mtimeMs: stats.mtimeMs };
      }),
  );

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || left.filePath.localeCompare(right.filePath));
  return candidates[0]?.filePath;
}

export async function loadLatestATISimpleReporterFromDirectory(directory: string) {
  const filePath = await findLatestNDJSONFile(directory);
  if (!filePath) {
    throw new Error(`Unable to find an ATI NDJSON file in '${directory}'`);
  }

  return loadATISimpleReporterFromNDJSONFile(filePath);
}
