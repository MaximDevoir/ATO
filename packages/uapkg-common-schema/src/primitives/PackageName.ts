import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a uapkg package name.
 * Must be lowercase alphanumeric with hyphens.
 */
export type PackageName = Brand<string, 'PackageName'>;

export const PackageNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Package name must be lowercase alphanumeric with hyphens')
  .transform((v) => v as PackageName);
