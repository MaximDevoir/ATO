export type DevBuildMode = 'build' | 'link' | 'watch' | 'unlink' | 'status';

export type CurrentGlobalUapkgState =
  | { kind: 'none' }
  | { kind: 'published'; version: string }
  | { kind: 'link'; path: string };

export type SavedGlobalUapkgState =
  | { kind: 'none' }
  | { kind: 'published'; version: string }
  | { kind: 'external-link'; path: string; restorePolicy: 'do-not-restore' };

export interface GlobalUapkgSnapshot {
  createdAt: string;
  workspaceRoot: string;
  packageName: 'uapkg';
  previous: SavedGlobalUapkgState;
}
