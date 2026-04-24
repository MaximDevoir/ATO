import { RegistryNameSchema, VersionRangeSchema } from '@uapkg/common-schema';
import { z } from 'zod';

/**
 * A dependency entry stored inside a registry version.
 *
 * Both `version` (range) and `registry` (logical name) are required
 * so that multi-registry resolution can work.
 */
export const RegistryDependencyLongSchema = z.object({
  version: VersionRangeSchema,
  registry: RegistryNameSchema.optional(),
});

export const RegistryDependencyShortSchema = VersionRangeSchema;

export const RegistryDependencyDeclarationSchema = z.union([
  RegistryDependencyShortSchema,
  RegistryDependencyLongSchema,
]);

export interface RegistryDependency {
  readonly version: z.infer<typeof VersionRangeSchema>;
  readonly registry?: z.infer<typeof RegistryNameSchema>;
}

export type RegistryDependencyDeclaration = z.infer<typeof RegistryDependencyDeclarationSchema>;

export const RegistryDependencySchema = RegistryDependencyDeclarationSchema.transform((input) =>
  normalizeRegistryDependencyDeclaration(input),
);

export function normalizeRegistryDependencyDeclaration(
  input: RegistryDependencyDeclaration | RegistryDependency,
): RegistryDependency {
  if (typeof input === 'string') {
    return { version: input };
  }

  return {
    version: input.version,
    registry: input.registry,
  };
}

export function toRegistryDependencyDeclaration(input: RegistryDependency): RegistryDependencyDeclaration {
  if (!input.registry) return input.version;
  return {
    version: input.version,
    registry: input.registry,
  };
}

export function normalizeRegistryDependencyRecord(
  input?: Record<string, RegistryDependencyDeclaration | RegistryDependency>,
): Record<string, RegistryDependency> | undefined {
  if (!input) return undefined;

  const out: Record<string, RegistryDependency> = {};
  for (const [name, dep] of Object.entries(input)) {
    out[name] = normalizeRegistryDependencyDeclaration(dep);
  }
  return out;
}

export function toRegistryDependencyRecordDeclaration(
  input?: Record<string, RegistryDependency>,
): Record<string, RegistryDependencyDeclaration> | undefined {
  if (!input) return undefined;

  const out: Record<string, RegistryDependencyDeclaration> = {};
  for (const [name, dep] of Object.entries(input)) {
    out[name] = toRegistryDependencyDeclaration(dep);
  }
  return out;
}
