import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a scoped-organization name (the `@org` in `@org/pkg`).
 * Follows npm-style scope rules: lowercase alphanumerics, hyphens, underscores;
 * must start with an alphanumeric.
 */
export type OrgName = Brand<string, 'OrgName'>;

export const OrgNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-_]*$/, 'Organization name must be lowercase alphanumeric with hyphens or underscores')
  .transform((v) => v as OrgName);

