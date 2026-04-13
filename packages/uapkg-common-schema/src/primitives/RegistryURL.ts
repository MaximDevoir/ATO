import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a registry git URL.
 */
export type RegistryURL = Brand<string, 'RegistryURL'>;

export const RegistryURLSchema = z
  .string()
  .url('Must be a valid URL')
  .transform((v) => v as RegistryURL);
