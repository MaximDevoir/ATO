import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Pack diagnostic codes
// ---------------------------------------------------------------------------

/** Cyclic symlink detected during file crawl. */
export type CyclicSymlinkDiagnostic = DiagnosticBase<'CYCLIC_SYMLINK', { readonly filePath: string }>;

/** Symlink resolves outside the plugin root. */
export type SymlinkOutsideRootDiagnostic = DiagnosticBase<'SYMLINK_OUTSIDE_ROOT', { readonly filePath: string }>;

/** Path normalization produced an invalid result. */
export type InvalidPathDiagnostic = DiagnosticBase<'INVALID_PATH', { readonly filePath: string }>;

/** No uapkg.json found walking upward from cwd. */
export type PluginRootNotFoundDiagnostic = DiagnosticBase<'PLUGIN_ROOT_NOT_FOUND', { readonly cwd: string }>;

/** Unresolved LFS pointer file (fatal when --allow-missing-lfs is off). */
export type UnresolvedLfsDiagnostic = DiagnosticBase<'UNRESOLVED_LFS', { readonly filePath: string }>;

/** LFS pointer was skipped (warning when --allow-missing-lfs is on). */
export type LfsSkippedDiagnostic = DiagnosticBase<'LFS_SKIPPED', { readonly filePath: string }>;

/** No files were selected for packing after filtering. */
export type NoFilesSelectedDiagnostic = DiagnosticBase<'NO_FILES_SELECTED', Record<string, never>>;

/** --outFile resolved to a directory instead of a file. */
export type OutFileIsDirectoryDiagnostic = DiagnosticBase<'OUTFILE_IS_DIRECTORY', { readonly filePath: string }>;

/** Plugin descriptor (*.uplugin) is required for pack operations. */
export type UpluginMissingDiagnostic = DiagnosticBase<'UPLUGIN_MISSING', { readonly pluginRoot: string }>;

/** Union of all pack diagnostics. */
export type PackDiagnostic =
  | CyclicSymlinkDiagnostic
  | SymlinkOutsideRootDiagnostic
  | InvalidPathDiagnostic
  | PluginRootNotFoundDiagnostic
  | UnresolvedLfsDiagnostic
  | LfsSkippedDiagnostic
  | NoFilesSelectedDiagnostic
  | OutFileIsDirectoryDiagnostic
  | UpluginMissingDiagnostic;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createCyclicSymlinkDiagnostic(filePath: string): CyclicSymlinkDiagnostic {
  return {
    level: 'error',
    code: 'CYCLIC_SYMLINK',
    message: `Cyclic symlink detected at ${filePath}.`,
    data: { filePath },
  };
}

export function createSymlinkOutsideRootDiagnostic(filePath: string): SymlinkOutsideRootDiagnostic {
  return {
    level: 'error',
    code: 'SYMLINK_OUTSIDE_ROOT',
    message: `Symlink resolves outside plugin root: ${filePath}.`,
    data: { filePath },
  };
}

export function createInvalidPathDiagnostic(filePath: string): InvalidPathDiagnostic {
  return { level: 'error', code: 'INVALID_PATH', message: `Invalid normalized path: ${filePath}.`, data: { filePath } };
}

export function createPluginRootNotFoundDiagnostic(cwd: string): PluginRootNotFoundDiagnostic {
  return {
    level: 'error',
    code: 'PLUGIN_ROOT_NOT_FOUND',
    message: 'No uapkg.json found from current directory upward.',
    hint: 'Run this command from within a uapkg project.',
    data: { cwd },
  };
}

export function createUnresolvedLfsDiagnostic(filePath: string): UnresolvedLfsDiagnostic {
  return {
    level: 'error',
    code: 'UNRESOLVED_LFS',
    message: `Unresolved LFS pointer file: ${filePath}.`,
    hint: "Run 'git lfs pull' or use --allow-missing-lfs.",
    data: { filePath },
  };
}

export function createLfsSkippedDiagnostic(filePath: string): LfsSkippedDiagnostic {
  return {
    level: 'warning',
    code: 'LFS_SKIPPED',
    message: `Skipping unresolved LFS file: ${filePath}.`,
    data: { filePath },
  };
}

export function createNoFilesSelectedDiagnostic(): NoFilesSelectedDiagnostic {
  return {
    level: 'error',
    code: 'NO_FILES_SELECTED',
    message: 'No files selected for packing after ignore/LFS resolution.',
    data: {},
  };
}

export function createOutFileIsDirectoryDiagnostic(filePath: string): OutFileIsDirectoryDiagnostic {
  return {
    level: 'error',
    code: 'OUTFILE_IS_DIRECTORY',
    message: '--outFile must be a file path, not a directory.',
    data: { filePath },
  };
}

export function createUpluginMissingDiagnostic(pluginRoot: string): UpluginMissingDiagnostic {
  return {
    level: 'error',
    code: 'UPLUGIN_MISSING',
    message: `No plugin descriptor (*.uplugin) was found in "${pluginRoot}".`,
    hint: 'Ensure your plugin root contains a .uplugin file before running `uapkg pack`.',
    data: { pluginRoot },
  };
}
