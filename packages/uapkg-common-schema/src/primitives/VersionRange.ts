import { validRange } from 'semver';
import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a valid semver range expression (e.g. `^1.2.0`, `>=0.5.0 <1.0.0`).
 */
export type VersionRange = Brand<string, 'VersionRange'>;

export const VersionRangeSchema = z
  .string()
  .refine((v) => validRange(v) !== null, { message: 'Invalid semver range' })
  .transform((v) => v as VersionRange);
