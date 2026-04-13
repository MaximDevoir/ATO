import { z } from 'zod';
import { BaseManifestSchema } from './BaseManifestSchema.js';

/**
 * Plugin manifest — `uapkg.json` for a plugin package.
 *
 * Plugins MUST NOT have `overrides`.
 */
export const PluginManifestSchema = BaseManifestSchema.extend({
  kind: z.literal('plugin'),
}).refine((data) => !('overrides' in data && data.overrides !== undefined), {
  message: 'Overrides are not allowed in plugin manifests',
  path: ['overrides'],
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
