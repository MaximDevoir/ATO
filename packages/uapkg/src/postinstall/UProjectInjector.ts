import fs from 'node:fs';

interface UProjectPluginEntry {
  Name?: string;
  Enabled?: boolean;
  [key: string]: unknown;
}

interface UProjectDocument {
  Plugins?: UProjectPluginEntry[];
  [key: string]: unknown;
}

export class UProjectInjector {
  apply(projectFilePath: string, pluginNames: string[]) {
    if (pluginNames.length === 0) {
      return;
    }

    const source = fs.readFileSync(projectFilePath, 'utf-8');
    let parsed: UProjectDocument;
    try {
      parsed = JSON.parse(source) as UProjectDocument;
    } catch (error) {
      throw new Error(
        `[uapkg] Failed to parse ${projectFilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const plugins = Array.isArray(parsed.Plugins) ? parsed.Plugins : [];
    const indexByName = new Map<string, number>();
    plugins.forEach((entry, index) => {
      if (typeof entry.Name === 'string' && entry.Name.trim()) {
        indexByName.set(entry.Name, index);
      }
    });

    for (const pluginName of pluginNames) {
      const existingIndex = indexByName.get(pluginName);
      if (existingIndex === undefined) {
        plugins.push({
          Name: pluginName,
          Enabled: true,
        });
        continue;
      }
      plugins[existingIndex] = {
        ...plugins[existingIndex],
        Enabled: true,
      };
    }

    parsed.Plugins = plugins;
    fs.writeFileSync(projectFilePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  }
}
