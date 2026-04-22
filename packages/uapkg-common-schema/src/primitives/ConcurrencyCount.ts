import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded integer representing a concurrency count (e.g. parallel downloads).
 * Must be a positive integer >= 1.
 */
export type ConcurrencyCount = Brand<number, 'ConcurrencyCount'>;

export const ConcurrencyCountSchema = z
  .number()
  .int()
  .min(1, 'Concurrency count must be at least 1')
  .transform((v) => v as ConcurrencyCount);

