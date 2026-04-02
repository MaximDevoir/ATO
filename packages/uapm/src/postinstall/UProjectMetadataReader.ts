import fs from 'node:fs';

interface UProjectModule {
  Name?: string;
}

interface UProjectDocument {
  Modules?: UProjectModule[];
}

export class UProjectMetadataReader {
  readModuleNames(uprojectPath: string) {
    const source = fs.readFileSync(uprojectPath, 'utf-8');
    let parsed: UProjectDocument;
    try {
      parsed = JSON.parse(source) as UProjectDocument;
    } catch (error) {
      throw new Error(
        `[uapm] Failed to parse ${uprojectPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return (parsed.Modules ?? []).map((entry) => entry.Name?.trim()).filter((value): value is string => Boolean(value));
  }
}
