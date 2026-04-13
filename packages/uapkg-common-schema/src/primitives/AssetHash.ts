import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for an asset integrity hash.
 * Format: `${hashMethod}:${hexHash}` (e.g. `sha256:abcdef…`).
 */
export type AssetHash = Brand<string, 'AssetHash'>;

export const AssetHashSchema = z
  .string()
  .regex(/^[a-z0-9]+:[a-f0-9]+$/, 'Must match format "algorithm:hexhash"')
  .transform((v) => v as AssetHash);
