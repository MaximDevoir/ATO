import { z } from 'zod';
import { OrgNameSchema } from './OrgName.js';
import { PackageNameSchema } from './PackageName.js';
import { VersionRangeSchema } from './VersionRange.js';

/**
 * Parsed CLI package specifier.
 *
 * Grammar: `(@<org>/)?<name>(@<range>)?`
 *
 * Examples:
 *   - `awesome-pkg`                              → { name: "awesome-pkg" }
 *   - `awesome-pkg@^1.0.0`                       → { name, range }
 *   - `@myorg/awesome-pkg`                       → { org, name }
 *   - `@myorg/awesome-pkg@^1.0.0`                → { org, name, range }
 */
export const PackageSpecSchema = z
  .object({
    org: OrgNameSchema.optional(),
    name: PackageNameSchema,
    range: VersionRangeSchema.optional(),
  })
  .strict();

export type PackageSpec = z.infer<typeof PackageSpecSchema>;

