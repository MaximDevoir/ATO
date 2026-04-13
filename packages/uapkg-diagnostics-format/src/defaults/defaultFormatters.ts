import type { FormatterMap } from '../contracts/FormatterTypes.js';
import { manifestFormatters } from '../formatters/manifest/manifestFormatters.js';
import { registryFormatters } from '../formatters/registry/registryFormatters.js';
import { resolverFormatters } from '../formatters/resolver/resolverFormatters.js';

/**
 * Merged map of all built-in formatters across families.
 */
export const defaultFormatters: FormatterMap = {
  ...resolverFormatters,
  ...registryFormatters,
  ...manifestFormatters,
};
