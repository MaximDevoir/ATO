import { installerInkComponents } from '../components/installerInkComponents.js';
import { manifestInkComponents } from '../components/manifestInkComponents.js';
import { postinstallInkComponents } from '../components/postinstallInkComponents.js';
import { registryInkComponents } from '../components/registryInkComponents.js';
import { resolverInkComponents } from '../components/resolverInkComponents.js';
import { safetyInkComponents } from '../components/safetyInkComponents.js';
import { specInkComponents } from '../components/specInkComponents.js';
import type { DiagnosticInkComponentMap } from '../contracts/InkTypes.js';

/**
 * Aggregated default Ink component map — one entry per well-known diagnostic
 * code. Unknown codes fall back to {@link PlainTextBody} inside
 * {@link DiagnosticView}, so the registry is always safe to call.
 *
 * Consumers that want custom behavior can either:
 *
 *   1. Pass a spread: `{ ...defaultInkComponents, MY_CODE: MyBody }`, or
 *   2. Instantiate a {@link DiagnosticInkRegistry} and `.register()` after.
 */
export const defaultInkComponents: DiagnosticInkComponentMap = {
  ...installerInkComponents,
  ...manifestInkComponents,
  ...postinstallInkComponents,
  ...registryInkComponents,
  ...resolverInkComponents,
  ...safetyInkComponents,
  ...specInkComponents,
};
