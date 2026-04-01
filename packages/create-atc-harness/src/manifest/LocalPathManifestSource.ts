import * as path from 'node:path';
import type { HarnessCreationResult } from '../domain/HarnessCreationResult';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';
import type { FileSystem } from '../services/FileSystem';
import type { ManifestResolutionContext, ManifestSource } from './ManifestSource';
import { readManifestAtPath, resolveManifestPath, resolvePluginRootFromManifestFolder } from './manifestHelpers';

export class LocalPathManifestSource implements ManifestSource {
  readonly name = 'LocalPathManifestSource';

  constructor(private readonly fileSystem: FileSystem) {}

  canAcceptManifestString(manifestString: string) {
    const resolved = path.resolve(manifestString);
    return this.fileSystem.exists(resolved);
  }

  async resolveManifest(
    context: ManifestResolutionContext,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ) {
    const manifestPath = resolveManifestPath(this.fileSystem, context.manifestString);
    const resolvedManifest = readManifestAtPath(this.fileSystem, manifestPath);

    return {
      manifestDirectory: resolvedManifest.manifestDirectory,
      manifestFilePath: resolvedManifest.manifestPath,
      manifest: resolvedManifest.manifest,
      installPlugin: (settings: HarnessCreationSettings) => {
        const pluginRoot = resolvePluginRootFromManifestFolder(this.fileSystem, resolvedManifest.manifestDirectory);
        const destination = path.join(settings.getHarnessPluginsDirectory(), path.basename(pluginRoot));
        liveStatus.setStatus(`[Plugin] Installing local plugin ${path.basename(pluginRoot)}...`);
        this.fileSystem.ensureDirectory(settings.getHarnessPluginsDirectory());
        this.fileSystem.copyDirectory(pluginRoot, destination);
        result.addLog(`Installed plugin from ${pluginRoot} to ${destination}`);
      },
    };
  }
}
