import fs from 'node:fs';
import path from 'node:path';
import {
  createConfigInvalidJsonDiagnostic,
  createConfigTypeMismatchDiagnostic,
  createIoErrorDiagnostic,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { ConfigReadResult } from '../contracts/ConfigTypes.js';

export class ConfigFileRepository {
  read(filePath: string): Result<ConfigReadResult> {
    if (!fs.existsSync(filePath)) {
      return ok({ exists: false, values: {}, diagnostics: [] });
    }

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      return {
        ok: true,
        value: {
          exists: true,
          values: {},
          diagnostics: [createIoErrorDiagnostic(filePath, String(error))],
        },
        diagnostics: [],
      };
    }

    if (raw.length === 0) {
      return ok({ exists: true, values: {}, diagnostics: [] });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return ok({
        exists: true,
        values: {},
        diagnostics: [
          createConfigInvalidJsonDiagnostic(filePath, error instanceof Error ? error.message : String(error)),
        ],
      });
    }

    if (!this.isRecord(parsed)) {
      return ok({
        exists: true,
        values: {},
        diagnostics: [
          createConfigTypeMismatchDiagnostic({
            path: '$',
            expectedType: 'object',
            actualType: this.describeType(parsed),
            source: 'file',
            filePath,
          }),
        ],
      });
    }

    return ok({
      exists: true,
      values: parsed,
      diagnostics: [],
    });
  }

  write(filePath: string, values: Record<string, unknown>): Result<void> {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
      return ok(undefined);
    } catch (error) {
      return {
        ok: false,
        diagnostics: [createIoErrorDiagnostic(filePath, String(error))],
      };
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private describeType(value: unknown): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }
}
