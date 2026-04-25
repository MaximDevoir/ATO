import { createUpluginMissingDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { CollectedFile } from '../contracts/PackTypes.js';

/**
 * Verifies a plugin descriptor file exists before packing.
 */
export class PluginDescriptorGuard {
  public validate(pluginRoot: string, files: readonly CollectedFile[]): Result<void> {
    const hasDescriptor = files.some((file) => file.relativePath.toLowerCase().endsWith('.uplugin'));
    if (hasDescriptor) return ok(undefined);
    return fail([createUpluginMissingDiagnostic(pluginRoot)]);
  }
}
