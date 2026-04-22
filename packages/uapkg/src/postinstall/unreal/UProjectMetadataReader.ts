import fs from 'node:fs';

interface UProjectModule {
  Name?: string;
}

interface UProjectDocument {
  Modules?: UProjectModule[];
}

/**
 * Reads the `Modules` array from a `.uproject` JSON file and returns the list
 * of module names. Used when no explicit `postinstall.modules` is configured
 * on the project manifest.
 */
export class UProjectMetadataReader {
  public readModuleNames(uprojectPath: string): string[] {
    const source = fs.readFileSync(uprojectPath, 'utf-8');
    let parsed: UProjectDocument;
    try {
      parsed = JSON.parse(source) as UProjectDocument;
    } catch (error) {
      throw new Error(`Failed to parse ${uprojectPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return (parsed.Modules ?? []).map((entry) => entry.Name?.trim()).filter((value): value is string => Boolean(value));
  }
}
