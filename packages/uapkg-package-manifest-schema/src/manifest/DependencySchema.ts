import { InstallPathSchema, type RegistryName, RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
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
const DEFAULT_REGISTRY = RegistryNameSchema.parse('default');

export const DependencyLongSchema = z.object({
  version: VersionRangeSchema,
  registry: RegistryNameSchema.optional(),
  path: InstallPathSchema.optional(),
});

export const DependencyShortSchema = VersionRangeSchema;

export const DependencyDeclarationSchema = z.union([DependencyShortSchema, DependencyLongSchema]);

export type DependencyDeclaration = z.infer<typeof DependencyDeclarationSchema>;

export interface Dependency {
  readonly version: z.infer<typeof VersionRangeSchema>;
  readonly registry: RegistryName;
  readonly path?: z.infer<typeof InstallPathSchema>;
}

export const DependencySchema = DependencyDeclarationSchema.transform((input) => normalizeDependencyDeclaration(input));

/**
 * Convert either dependency declaration style into canonical full form.
 */
export function normalizeDependencyDeclaration(input: DependencyDeclaration | Dependency): Dependency {
  if (typeof input === 'string') {
    return {
      version: input,
      registry: DEFAULT_REGISTRY,
    };
  }

  return {
    version: input.version,
    registry: input.registry ?? DEFAULT_REGISTRY,
    path: input.path,
  };
}

/**
 * Convert a canonical dependency into declaration form, preferring short form
 * when no extra metadata would be lost.
 */
export function toDependencyDeclaration(input: Dependency): DependencyDeclaration {
  const normalized = normalizeDependencyDeclaration(input);

  if (normalized.registry === DEFAULT_REGISTRY && normalized.path === undefined) {
    return normalized.version;
  }

  if (normalized.registry === DEFAULT_REGISTRY) {
    return {
      version: normalized.version,
      path: normalized.path,
    };
  }

  return {
    version: normalized.version,
    registry: normalized.registry,
    path: normalized.path,
  };
}

export function normalizeDependencyRecord(
  input?: Record<string, DependencyDeclaration | Dependency>,
): Record<string, Dependency> | undefined {
  if (!input) return undefined;

  const out: Record<string, Dependency> = {};
  for (const [name, dep] of Object.entries(input)) {
    out[name] = normalizeDependencyDeclaration(dep);
  }
  return out;
}

export function toDependencyRecordDeclaration(
  input?: Record<string, Dependency>,
): Record<string, DependencyDeclaration> | undefined {
  if (!input) return undefined;

  const out: Record<string, DependencyDeclaration> = {};
  for (const [name, dep] of Object.entries(input)) {
    out[name] = toDependencyDeclaration(dep);
  }
  return out;
}
