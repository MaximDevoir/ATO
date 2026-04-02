import fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LockedPackage } from '../lockfile/UAPMLockfile';
import { type LoadedPostinstallScript, PostinstallScriptSchema } from './PostinstallTypes';

export class PostinstallScriptLoader {
  async loadFromInstalledPlugins(projectRoot: string, packages: LockedPackage[]): Promise<LoadedPostinstallScript[]> {
    const pluginRoots = packages
      .map((entry) => ({
        pluginName: entry.name,
        pluginRoot: path.join(projectRoot, 'Plugins', entry.name),
      }))
      .filter((entry) => fs.existsSync(entry.pluginRoot))
      .sort((a, b) => a.pluginName.localeCompare(b.pluginName));

    const scripts: LoadedPostinstallScript[] = [];
    for (const plugin of pluginRoots) {
      const scriptPath = this.resolveScriptPath(plugin.pluginRoot);
      if (!scriptPath) {
        continue;
      }
      const loaded = await this.loadScript(scriptPath);
      scripts.push({
        pluginName: plugin.pluginName,
        pluginRoot: plugin.pluginRoot,
        scriptPath,
        script: loaded,
      });
    }
    return scripts;
  }

  private resolveScriptPath(pluginRoot: string) {
    const tsPath = path.join(pluginRoot, '.uapm', 'postinstall.ts');
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }
    const jsPath = path.join(pluginRoot, '.uapm', 'postinstall.js');
    if (fs.existsSync(jsPath)) {
      return jsPath;
    }
    return undefined;
  }

  private async loadScript(scriptPath: string) {
    let moduleValue: unknown;
    try {
      moduleValue = await import(pathToFileURL(scriptPath).href);
    } catch (error) {
      throw new Error(
        `[uapm] Failed to import postinstall script ${scriptPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const exported = this.unwrapModuleExport(moduleValue);
    const parsed = PostinstallScriptSchema.safeParse(exported);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw new Error(`[uapm] Invalid postinstall export ${scriptPath}: ${errors}`);
    }
    return parsed.data;
  }

  private unwrapModuleExport(moduleValue: unknown) {
    if (moduleValue && typeof moduleValue === 'object') {
      const moduleObject = moduleValue as Record<string, unknown>;
      return moduleObject.default ?? moduleObject;
    }
    return moduleValue;
  }
}
