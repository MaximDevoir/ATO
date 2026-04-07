import fs from 'node:fs';
import path from 'node:path';
import type { ConfigReadResult } from '../contracts/ConfigTypes.js';
import { partialConfigSchema } from '../schema/configSchema.js';

export class ConfigFileRepository {
  read(filePath: string): ConfigReadResult {
    if (!fs.existsSync(filePath)) {
      return { exists: false, values: {} };
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw.length === 0) {
      return { exists: true, values: {} };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(`[uapkg] Invalid JSON in config file ${filePath}: ${details}`);
    }

    const validation = partialConfigSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(
        `[uapkg] Invalid config file ${filePath}: ${validation.error.issues[0]?.message ?? 'unknown error'}`,
      );
    }

    return {
      exists: true,
      values: (validation.data as Record<string, unknown>) ?? {},
    };
  }

  write(filePath: string, values: Record<string, unknown>) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
  }
}
