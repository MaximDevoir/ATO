import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a git tree SHA (40-char hex string).
 */
export type GitTree = Brand<string, 'GitTree'>;

export const GitTreeSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/, 'Must be a 40-character lowercase hex SHA')
  .transform((v) => v as GitTree);
