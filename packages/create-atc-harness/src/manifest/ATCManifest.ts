export interface ATCManifest {
  type: 'plugin';
  harness: string;
  name?: string;
}

export function parseAndValidateATCManifest(rawManifest: string, sourcePath: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(
      `[create-atc-harness] Failed to parse atc.json at ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`[create-atc-harness] atc.json at ${sourcePath} must be a JSON object`);
  }

  const manifest = parsed as Partial<ATCManifest>;
  if (manifest.type !== 'plugin') {
    throw new Error(`[create-atc-harness] atc.json at ${sourcePath} must contain type: "plugin"`);
  }

  if (typeof manifest.harness !== 'string' || !manifest.harness.trim()) {
    throw new Error(`[create-atc-harness] atc.json at ${sourcePath} must contain a non-empty string harness value`);
  }

  return {
    type: 'plugin',
    harness: manifest.harness.trim(),
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : undefined,
  } satisfies ATCManifest;
}
