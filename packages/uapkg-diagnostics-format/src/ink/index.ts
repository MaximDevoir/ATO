// ---------------------------------------------------------------------------
// @uapkg/diagnostics-format — Ink surface
//
// This is the "standardized component factory" subpath every consumer should
// import from when they want to render diagnostics as Ink elements.
//
// Plain-data helpers (formatters returning strings) remain exported from the
// package root; Ink helpers live here so consumers that don't ship a TTY UI
// pay zero React/Ink cost.
// ---------------------------------------------------------------------------

export type {
  DiagnosticBodyComponent,
  DiagnosticBodyProps,
  DiagnosticInkComponentMap,
  IDiagnosticInkRegistry,
} from './contracts/InkTypes.js';

export { defaultInkComponents } from './defaults/defaultInkComponents.js';
export { createInkRegistry, DiagnosticInkRegistry } from './registry/DiagnosticInkRegistry.js';

// Family component maps — exported individually so consumers can cherry-pick.
export { installerInkComponents } from './components/installerInkComponents.js';
export { manifestInkComponents } from './components/manifestInkComponents.js';
export { postinstallInkComponents } from './components/postinstallInkComponents.js';
export { registryInkComponents } from './components/registryInkComponents.js';
export { resolverInkComponents } from './components/resolverInkComponents.js';
export { safetyInkComponents } from './components/safetyInkComponents.js';
export { specInkComponents } from './components/specInkComponents.js';

// Primitives.
export { HintLine } from './primitives/HintLine.js';
export { PlainTextBody } from './primitives/PlainTextBody.js';
export { SeverityBadge } from './primitives/SeverityBadge.js';

// Views.
export { DiagnosticView, type DiagnosticViewProps } from './views/DiagnosticView.js';
export {
  DiagnosticsListView,
  type DiagnosticsListViewProps,
} from './views/DiagnosticsListView.js';


