import * as path from 'node:path';
import type { HarnessCreationResult } from '../domain/HarnessCreationResult.js';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings.js';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle.js';
import type { FileSystem } from '../services/FileSystem.js';
import type { ManifestResolutionContext, ManifestSource } from './ManifestSource.js';
import {
  readManifestAtPath,
  resolveManifestPath,
  resolvePluginInstallDirectoryName,
  resolvePluginRootFromManifestFolder,
} from './manifestHelpers.js';

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
        const pluginInstallDirectoryName = resolvePluginInstallDirectoryName(
          this.fileSystem,
          resolvedManifest.manifestDirectory,
          resolvedManifest.manifest.name,
        );
        const destination = path.join(settings.getHarnessPluginsDirectory(), pluginInstallDirectoryName);
        liveStatus.setStatus(`[Plugin] Installing local plugin ${pluginInstallDirectoryName}...`);
        this.fileSystem.ensureDirectory(settings.getHarnessPluginsDirectory());
        this.fileSystem.copyDirectory(pluginRoot, destination);
        result.addLog(`Installed plugin from ${pluginRoot} to ${destination}`);
      },
    };
  }
}
