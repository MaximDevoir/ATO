import { valid as semverValid } from 'semver';
import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a valid semver v2 version string (no `v` or `=` prefix).
 */
export type PackageVersion = Brand<string, 'PackageVersion'>;

export const PackageVersionSchema = z
  .string()
  .refine((v) => semverValid(v) !== null, { message: 'Invalid semver version' })
  .transform((v) => v as PackageVersion);
