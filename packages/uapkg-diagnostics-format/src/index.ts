// ---------------------------------------------------------------------------
// @uapkg/diagnostics-format — public API
// ---------------------------------------------------------------------------

export type { DiagnosticFormatterFn, FormatterMap, IFormatterRegistry } from './contracts/FormatterTypes.js';
export { defaultFormatters } from './defaults/defaultFormatters.js';
export { installerFormatters } from './formatters/installer/installerFormatters.js';
export { manifestFormatters } from './formatters/manifest/manifestFormatters.js';
export { formatPlainText } from './formatters/PlainTextFormatter.js';
export { postinstallFormatters } from './formatters/postinstall/postinstallFormatters.js';
export { registryFormatters } from './formatters/registry/registryFormatters.js';
export { resolverFormatters } from './formatters/resolver/resolverFormatters.js';
export { safetyFormatters } from './formatters/safety/safetyFormatters.js';
export { specFormatters } from './formatters/spec/specFormatters.js';
export { createFormatterRegistry, FormatterRegistry } from './registry/FormatterRegistry.js';
export { bulletList, indent } from './utils/indent.js';
