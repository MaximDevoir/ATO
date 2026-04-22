import { InstallPathSchema, RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * A dependency intent entry in `uapkg.json`.
 *
 * - `version`  — semver range (branded)
 * - `registry` — logical registry name (branded)
 * - `path`     — OPTIONAL install path relative to manifest root.
 *                Only meaningful on **project** manifests; on plugin manifests
 *                a warning (`SAFETY_PATH_NOT_PROJECT_MANIFEST`) is emitted by
 *                the installer and the default path (`Plugins/<name>`) is used.
 */
export const DependencySchema = z.object({
  version: VersionRangeSchema,
  registry: RegistryNameSchema,
  path: InstallPathSchema.optional(),
});

export type Dependency = z.infer<typeof DependencySchema>;
