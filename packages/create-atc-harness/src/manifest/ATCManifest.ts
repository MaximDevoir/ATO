export interface ATCManifest {
  type: 'plugin';
  harness: string;
  name?: string;
  dependencies?: Array<{
    name: string;
    source: string;
    version?: string;
  }>;
  harnessedPlugins?: string[];
}

export function parseAndValidateATCManifest(rawManifest: string, sourcePath: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(
      `[create-atc-harness] Failed to parse uapm.json at ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`[create-atc-harness] uapm.json at ${sourcePath} must be a JSON object`);
  }

  const manifest = parsed as Partial<ATCManifest>;
  if (manifest.type !== 'plugin') {
    throw new Error(`[create-atc-harness] uapm.json at ${sourcePath} must contain type: "plugin"`);
  }

  if (typeof manifest.harness !== 'string' || !manifest.harness.trim()) {
    throw new Error(`[create-atc-harness] uapm.json at ${sourcePath} must contain a non-empty string harness value`);
  }

  return {
    type: 'plugin',
    harness: manifest.harness.trim(),
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : undefined,
    dependencies: Array.isArray(manifest.dependencies)
      ? manifest.dependencies
          .filter((entry): entry is { name: string; source: string; version?: string } =>
            Boolean(
              entry &&
                typeof entry === 'object' &&
                typeof (entry as { name?: unknown }).name === 'string' &&
                typeof (entry as { source?: unknown }).source === 'string',
            ),
          )
          .map((entry) => ({
            name: entry.name,
            source: entry.source,
            version: typeof entry.version === 'string' ? entry.version : undefined,
          }))
      : [],
    harnessedPlugins: Array.isArray(manifest.harnessedPlugins)
      ? manifest.harnessedPlugins.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
      : [],
  } satisfies ATCManifest;
}
