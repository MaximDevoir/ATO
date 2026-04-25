import type { Result } from '@uapkg/diagnostics';
import { partialConfigSchema } from '../configSchema.js';
import { ConfigCliValueParser } from './ConfigCliValueParser.js';
import { ConfigSchemaRuntime } from './ConfigSchemaRuntime.js';

const runtime = new ConfigSchemaRuntime(partialConfigSchema);
const cliValueParser = new ConfigCliValueParser(runtime);

export function getConfigSchemaRuntime(): ConfigSchemaRuntime {
  return runtime;
}

export function parseConfigCliValue(pathToProperty: string, rawValue: string): Result<unknown> {
  return cliValueParser.parse(pathToProperty, rawValue);
}
