import fs from 'node:fs';
import {
  type Result,
  ok,
  fail,
  createIoErrorDiagnostic,
  createParseErrorDiagnostic,
} from '@uapkg/diagnostics';

interface UProjectPluginEntry {
  Name?: string;
  Enabled?: boolean;
  [key: string]: unknown;
}

interface UProjectDocument {
  Plugins?: UProjectPluginEntry[];
  [key: string]: unknown;
}

/**
 * Enables the given plugin names in the host project's `.uproject` file,
 * preserving all other fields. Adds new entries with `Enabled: true` when the
 * plugin isn't already listed; toggles `Enabled: true` on existing entries.
 *
 * Never throws — returns a `Result<void>`.
 */
export class UProjectInjector {
  public apply(projectFilePath: string, pluginNames: readonly string[]): Result<void> {
    if (pluginNames.length === 0) return ok(undefined);

    let source: string;
    try {
      source = fs.readFileSync(projectFilePath, 'utf-8');
    } catch (error) {
      return fail([
        createIoErrorDiagnostic(projectFilePath, error instanceof Error ? error.message : String(error)),
      ]);
    }

    let parsed: UProjectDocument;
    try {
      parsed = JSON.parse(source) as UProjectDocument;
    } catch (error) {
      return fail([
        createParseErrorDiagnostic(
          error instanceof Error ? error.message : String(error),
          projectFilePath,
        ),
      ]);
    }

    const plugins = Array.isArray(parsed.Plugins) ? [...parsed.Plugins] : [];
    const indexByName = new Map<string, number>();
    plugins.forEach((entry, index) => {
      if (typeof entry.Name === 'string' && entry.Name.trim()) indexByName.set(entry.Name, index);
    });

    for (const pluginName of pluginNames) {
      const existingIndex = indexByName.get(pluginName);
      if (existingIndex === undefined) {
        plugins.push({ Name: pluginName, Enabled: true });
        continue;
      }
      plugins[existingIndex] = { ...plugins[existingIndex], Enabled: true };
    }

    parsed.Plugins = plugins;
    try {
      fs.writeFileSync(projectFilePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
    } catch (error) {
      return fail([
        createIoErrorDiagnostic(projectFilePath, error instanceof Error ? error.message : String(error)),
      ]);
    }
    return ok(undefined);
  }
}

