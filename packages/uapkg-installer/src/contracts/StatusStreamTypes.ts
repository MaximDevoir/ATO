import type { PackageName, PackageVersion } from '@uapkg/common-schema';

/**
 * Lifecycle state of a single installer work-slot.
 *
 * One status row per slot; slot ids are stable across frames so Ink can
 * render a fixed-height region without re-flowing.
 */
export type SlotState =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'removing'
  | 'done'
  | 'failed';

/**
 * Per-slot status snapshot.
 */
export interface SlotSnapshot {
  readonly slotId: number;
  readonly state: SlotState;
  readonly packageName?: PackageName;
  readonly version?: PackageVersion;
  readonly bytesDone: number;
  readonly bytesTotal?: number;
  readonly attempt: number;
}

/**
 * Aggregate totals across all actions in the plan.
 */
export interface InstallTotals {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly bytesDone: number;
  readonly bytesTotal: number;
}

/**
 * Immutable snapshot yielded by `Installer.getStatusStream()`. The CLI view
 * re-renders whenever a new snapshot arrives.
 */
export interface DownloadStatusSnapshot {
  readonly slots: readonly SlotSnapshot[];
  readonly totals: InstallTotals;
}

