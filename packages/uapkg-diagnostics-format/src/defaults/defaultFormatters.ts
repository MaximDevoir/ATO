import type { FormatterMap } from '../contracts/FormatterTypes.js';
import { configFormatters } from '../formatters/config/configFormatters.js';
import { installerFormatters } from '../formatters/installer/installerFormatters.js';
import { manifestFormatters } from '../formatters/manifest/manifestFormatters.js';
import { packFormatters } from '../formatters/pack/packFormatters.js';
import { postinstallFormatters } from '../formatters/postinstall/postinstallFormatters.js';
import { registryFormatters } from '../formatters/registry/registryFormatters.js';
import { resolverFormatters } from '../formatters/resolver/resolverFormatters.js';
import { safetyFormatters } from '../formatters/safety/safetyFormatters.js';
import { specFormatters } from '../formatters/spec/specFormatters.js';

/**
 * Merged map of all built-in formatters across families.
 */
export const defaultFormatters: FormatterMap = {
  ...resolverFormatters,
  ...configFormatters,
  ...registryFormatters,
  ...manifestFormatters,
  ...packFormatters,
  ...installerFormatters,
  ...postinstallFormatters,
  ...safetyFormatters,
  ...specFormatters,
};
