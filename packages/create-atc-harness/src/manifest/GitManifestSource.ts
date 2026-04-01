import * as path from 'node:path';
import type { HarnessCreationResult } from '../domain/HarnessCreationResult';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';
import type { FileSystem } from '../services/FileSystem';
import type { GitService } from '../services/GitService';
import { isGitLikeReference, parseGitReference } from '../services/GitUrl';
import type { ManifestResolutionContext, ManifestSource } from './ManifestSource';
import { readManifestAtPath, resolvePluginRootFromManifestFolder } from './manifestHelpers';

export class GitManifestSource implements ManifestSource {
  readonly name = 'GitManifestSource';

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly gitService: GitService,
  ) {}

  canAcceptManifestString(manifestString: string) {
    return isGitLikeReference(manifestString) && this.gitService.isGitAvailable();
  }

  async resolveManifest(
    context: ManifestResolutionContext,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ) {
    const tempDirectory = this.fileSystem.createTemporaryDirectory('atc-manifest-');
    const gitReference = parseGitReference(context.manifestString);
    const refInfo = gitReference.ref ? ` @ ${gitReference.ref}` : '';
    liveStatus.setStatus(`[Manifest] Cloning plugin manifest repository ${gitReference.repositoryUrl}${refInfo}`);
    await this.gitService.clone(gitReference.repositoryUrl, tempDirectory, gitReference.ref);

    const manifestPath = path.join(tempDirectory, 'atc.json');
    if (!this.fileSystem.exists(manifestPath)) {
      throw new Error(
        `[create-atc-harness] Git manifest repositories must contain atc.json at the repository root: ${context.manifestString}`,
      );
    }

    if (this.gitService.hasLfsTracking(tempDirectory)) {
      if (!this.gitService.isGitLfsAvailable()) {
        throw new Error(
          '[create-atc-harness] Repository uses Git LFS (.gitattributes filter=lfs), but git lfs is not installed',
        );
      }
      liveStatus.setStatus('[Manifest] Git LFS detected; pulling LFS content...');
      await this.gitService.pullLfs(tempDirectory);
    }

    const resolvedManifest = readManifestAtPath(this.fileSystem, manifestPath);

    return {
      manifestDirectory: resolvedManifest.manifestDirectory,
      manifestFilePath: resolvedManifest.manifestPath,
      manifest: resolvedManifest.manifest,
      installPlugin: (settings: HarnessCreationSettings) => {
        const pluginRoot = resolvePluginRootFromManifestFolder(this.fileSystem, resolvedManifest.manifestDirectory);
        const destination = path.join(settings.getHarnessPluginsDirectory(), path.basename(pluginRoot));
        liveStatus.setStatus(`[Plugin] Installing plugin ${path.basename(pluginRoot)} from cloned repository...`);
        this.fileSystem.ensureDirectory(settings.getHarnessPluginsDirectory());
        this.fileSystem.copyDirectory(pluginRoot, destination);
        result.addLog(`Installed plugin from ${pluginRoot} to ${destination}`);
      },
      cleanup: () => {
        this.fileSystem.removeDirectory(tempDirectory);
      },
    };
  }
}
