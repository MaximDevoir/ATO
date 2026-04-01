import type { HarnessCreationResult } from '../domain/HarnessCreationResult';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';
import type { ATCManifest } from './ATCManifest';

export interface ManifestResolution {
  manifestDirectory: string;
  manifestFilePath: string;
  manifest: ATCManifest;
  installPlugin(settings: HarnessCreationSettings, result: HarnessCreationResult, liveStatus: LiveStatusHandle): void;
  cleanup?(): void;
}

export interface ManifestResolutionContext {
  manifestString: string;
  outputRootDirectory: string;
}

export interface ManifestSource {
  readonly name: string;
  canAcceptManifestString(manifestString: string): boolean;
  resolveManifest(
    context: ManifestResolutionContext,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ): Promise<ManifestResolution>;
}
