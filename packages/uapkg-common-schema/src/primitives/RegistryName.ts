import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for a logical registry name (the key under `registries` in config).
 */
export type RegistryName = Brand<string, 'RegistryName'>;

export const RegistryNameSchema = z
  .string()
  .min(1, 'Registry name must not be empty')
  .transform((v) => v as RegistryName);
