import type { CurrentGlobalUapkgState, GlobalUapkgSnapshot } from './types';

export class DevBuildStatusPrinter {
  printLinkStart(force: boolean) {
    console.log(`[dev-build] build:link started${force ? ' (force)' : ''}`);
  }

  printSnapshotPreserved(snapshotPath: string) {
    console.log(`[dev-build] Snapshot already exists; preserving restore state: ${snapshotPath}`);
  }

  printSnapshotCreated(snapshotPath: string) {
    console.log(`[dev-build] Saved global uapkg snapshot: ${snapshotPath}`);
  }

  printAlreadyLinkedToWorkspace() {
    console.log('[dev-build] uapkg is already linked to this workspace; preserving existing snapshot.');
  }

  printExternalLinkDetected(path: string) {
    console.log('[dev-build] Global uapkg is currently linked to another development checkout.');
    console.log(`[dev-build] Previous external link recorded for diagnostics only: ${path}`);
  }

  printExternalLinkNotRestored(path: string) {
    console.log('[dev-build] Previous global uapkg was another development link.');
    console.log(`[dev-build] Previous link path: ${path}`);
    console.log('[dev-build] External development links are not restored automatically.');
    console.log('[dev-build] Restore manually if needed:');
    console.log(`[dev-build]   cd ${path}`);
    console.log('[dev-build]   pnpm link --global');
  }

  printUnlinkRefusedWithoutForce() {
    console.log('[dev-build] No snapshot found and current global uapkg is not this workspace.');
    console.log('[dev-build] Refusing to remove global uapkg. Re-run with --force to override.');
  }

  printSnapshotRetainedAfterFailure(snapshotPath: string) {
    console.log('[dev-build] Restore failed. Snapshot was retained so you can retry.');
    console.log(`[dev-build] Snapshot: ${snapshotPath}`);
  }

  printSnapshotRemoved(snapshotPath: string) {
    console.log(`[dev-build] Snapshot removed: ${snapshotPath}`);
  }

  printGlobalShimUpdated(shimPath: string) {
    console.log(`[dev-build] Updated global uapkg shim: ${shimPath}`);
  }

  printStatus(args: {
    snapshotPath: string;
    snapshot: GlobalUapkgSnapshot | null;
    current: CurrentGlobalUapkgState;
    isLinkedToWorkspace: boolean;
    binaryPath: string | null;
    globalBinDir: string | null;
    isGlobalBinOnPath: boolean;
    workspaceShimPath: string | null;
  }) {
    const devMode = args.isLinkedToWorkspace ? 'ACTIVE' : 'INACTIVE';
    console.log(`Dev Mode: ${devMode}`);
    console.log(`Snapshot: ${args.snapshot ? args.snapshotPath : 'none'}`);
    console.log(`Current: ${this.describeCurrent(args.current)}`);

    if (args.snapshot) {
      console.log(`Previous: ${this.describePrevious(args.snapshot)}`);
    } else {
      console.log('Previous: unavailable (no snapshot)');
    }

    console.log(`Global Bin: ${args.globalBinDir ?? 'unknown'}`);
    console.log(`Global Bin In PATH: ${args.isGlobalBinOnPath ? 'yes' : 'no'}`);
    console.log(`Workspace Shim: ${args.workspaceShimPath ?? 'not found'}`);
    console.log(`Binary: ${args.binaryPath ?? 'not found on PATH'}`);

    if (args.globalBinDir && !args.isGlobalBinOnPath) {
      console.log(`[dev-build] Add this to PATH and open a new terminal: ${args.globalBinDir}`);
    }
  }

  private describeCurrent(current: CurrentGlobalUapkgState) {
    if (current.kind === 'none') {
      return 'uapkg: none';
    }

    if (current.kind === 'published') {
      return `uapkg: published version=${current.version}`;
    }

    return `uapkg: linked path=${current.path}`;
  }

  private describePrevious(snapshot: GlobalUapkgSnapshot) {
    const previous = snapshot.previous;
    if (previous.kind === 'none') {
      return 'kind=none';
    }

    if (previous.kind === 'published') {
      return `kind=published version=${previous.version}`;
    }

    return `kind=external-link path=${previous.path} restorePolicy=${previous.restorePolicy}`;
  }
}
