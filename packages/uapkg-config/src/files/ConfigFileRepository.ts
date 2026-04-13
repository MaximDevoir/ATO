import fs from 'node:fs';
import path from 'node:path';
import {
  createIoErrorDiagnostic,
  createParseErrorDiagnostic,
  createSchemaInvalidDiagnostic,
  fail,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { ConfigReadResult } from '../contracts/ConfigTypes.js';
import { partialConfigSchema } from '../schema/configSchema.js';

export class ConfigFileRepository {
  read(filePath: string): Result<ConfigReadResult> {
    if (!fs.existsSync(filePath)) {
      return ok({ exists: false, values: {} });
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw.length === 0) {
      return ok({ exists: true, values: {} });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      return fail([createParseErrorDiagnostic(`Invalid JSON in config file ${filePath}: ${details}`, filePath)]);
    }

    const validation = partialConfigSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return fail([createSchemaInvalidDiagnostic(filePath, issues)]);
    }

    return ok({
      exists: true,
      values: (validation.data as Record<string, unknown>) ?? {},
    });
  }

  write(filePath: string, values: Record<string, unknown>): Result<void> {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
      return ok(undefined);
    } catch (error) {
      return fail([createIoErrorDiagnostic(filePath, String(error))]);
    }
  }
}
