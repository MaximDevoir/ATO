import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * Branded type for the full registry identifier (64-char hex SHA-256).
 */
export type RegistryIdentifier = Brand<string, 'RegistryIdentifier'>;

export const RegistryIdentifierSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Must be a 64-character lowercase hex SHA-256')
  .transform((v) => v as RegistryIdentifier);

/**
 * Branded type for the short registry identifier (first 16 hex chars).
 */
export type RegistryIdentifierShort = Brand<string, 'RegistryIdentifierShort'>;

export const RegistryIdentifierShortSchema = z
  .string()
  .regex(/^[a-f0-9]{16}$/, 'Must be a 16-character lowercase hex prefix')
  .transform((v) => v as RegistryIdentifierShort);
