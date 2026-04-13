import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a Unix timestamp (seconds since epoch, UTC).
 */
export type UnixTimestamp = Brand<number, 'UnixTimestamp'>;

export const UnixTimestampSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((v) => v as UnixTimestamp);
