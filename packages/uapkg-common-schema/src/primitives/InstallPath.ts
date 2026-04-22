import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a package install path, relative to the uapkg manifest root.
 *
 * Rules:
 *  - forward slashes only
 *  - no leading slash (must be relative)
 *  - no `..` segments (no escaping the manifest root)
 *  - non-empty
 *
 * Example: `Plugins/AwesomeInventorySystem`
 */
export type InstallPath = Brand<string, 'InstallPath'>;

const FORBIDDEN_SEGMENT = /(^|\/)\.\.(\/|$)/;

export const InstallPathSchema = z
  .string()
  .min(1, 'Install path must not be empty')
  .refine((v) => !v.includes('\\'), 'Install path must use forward slashes')
  .refine((v) => !v.startsWith('/'), 'Install path must be relative (no leading slash)')
  .refine((v) => !FORBIDDEN_SEGMENT.test(v), 'Install path must not contain ".." segments')
  .transform((v) => v as InstallPath);
