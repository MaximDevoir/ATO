// ---------------------------------------------------------------------------
// @uapkg/installer — public API
// ---------------------------------------------------------------------------

// Contracts
export type {
  InstallAction,
  InstallActionType,
  InstallPlan,
  InstallSummary,
  InstallerOptions,
} from './contracts/InstallerTypes.js';
export type {
  BuiltInSafetyPolicyId,
  SafetyContext,
  SafetyEvaluation,
  SafetyPolicy,
} from './contracts/SafetyPolicyTypes.js';
export type {
  DownloadStatusSnapshot,
  InstallTotals,
  SlotSnapshot,
  SlotState,
} from './contracts/StatusStreamTypes.js';

// Core
export { type DiskStateEntry, DiskStateInspector } from './core/DiskStateInspector.js';
export { Installer, type InstallerConstructorOptions } from './core/Installer.js';
export { InstallPlanner } from './core/InstallPlanner.js';
export { IntegrityVerifier } from './core/IntegrityVerifier.js';
export { type DownloadProgress, type DownloadOptions, type DownloadResult, PackageDownloader } from './core/PackageDownloader.js';
export { PackageExtractor } from './core/PackageExtractor.js';
export { PackageRemover } from './core/PackageRemover.js';

// Safety
export { NoMarkerPolicy } from './safety/NoMarkerPolicy.js';
export { type SafetyVerdict, SafetyPolicyRegistry } from './safety/SafetyPolicyRegistry.js';

// Status
export { SlotTable } from './status/SlotTable.js';
export { StatusStream } from './status/StatusStream.js';

