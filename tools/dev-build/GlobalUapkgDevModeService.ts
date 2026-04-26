import type { BuildService } from './BuildService';
import type { DevBuildStatusPrinter } from './DevBuildStatusPrinter';
import type { GlobalCommandShimService } from './GlobalCommandShimService';
import type { GlobalUapkgSnapshotStore } from './GlobalUapkgSnapshotStore';
import type { GlobalUapkgStateService } from './GlobalUapkgStateService';
import type { CurrentGlobalUapkgState, SavedGlobalUapkgState } from './types';

export class GlobalUapkgDevModeService {
  constructor(
    private readonly buildService: BuildService,
    private readonly stateService: GlobalUapkgStateService,
    private readonly snapshotStore: GlobalUapkgSnapshotStore,
    private readonly statusPrinter: DevBuildStatusPrinter,
    private readonly shimService: GlobalCommandShimService,
  ) {}

  link(options: { force: boolean }) {
    this.statusPrinter.printLinkStart(options.force);
    const currentState = this.stateService.detectCurrentState();
    this.ensureSnapshot(currentState, options.force);

    this.buildService.buildCliWithDependencies();
    this.stateService.removeGlobalUapkg(true);
    this.stateService.linkCurrentWorkspaceCli();

    const shim = this.shimService.ensureWorkspaceGlobalShims();
    if (shim) {
      this.statusPrinter.printGlobalShimUpdated(shim.activeShimPath);
    }

    this.shimService.cleanupLegacyWorkspaceRootShims();
    this.printStatus();
  }

  unlink(options: { force: boolean }) {
    const snapshot = this.snapshotStore.read();

    if (!snapshot) {
      this.unlinkWithoutSnapshot(options.force);
      this.shimService.cleanupLegacyWorkspaceRootShims();
      this.printStatus();
      return;
    }

    try {
      this.stateService.removeGlobalUapkg(true);
      this.shimService.removeWorkspaceGlobalShims();
      this.restoreFromSnapshot(snapshot.previous);
      this.snapshotStore.remove();
      this.statusPrinter.printSnapshotRemoved(this.snapshotStore.getSnapshotPath());
    } catch (error) {
      this.statusPrinter.printSnapshotRetainedAfterFailure(this.snapshotStore.getSnapshotPath());
      throw error;
    }

    this.shimService.cleanupLegacyWorkspaceRootShims();
    this.printStatus();
  }

  printStatus() {
    const snapshot = this.snapshotStore.read();
    const current = this.stateService.detectCurrentState();
    const isLinkedToWorkspace = this.stateService.isLinkedToWorkspace(current);
    const globalBinDir = this.shimService.getGlobalBinDir();
    const isGlobalBinOnPath = globalBinDir ? this.shimService.isGlobalBinOnPath(globalBinDir) : false;
    const workspaceShimPath = this.shimService.resolveWorkspaceShimPath();
    const binaryPath = workspaceShimPath ?? this.shimService.resolveBinaryFromPath();

    this.statusPrinter.printStatus({
      snapshotPath: this.snapshotStore.getSnapshotPath(),
      snapshot,
      current,
      isLinkedToWorkspace,
      binaryPath,
      globalBinDir,
      isGlobalBinOnPath,
      workspaceShimPath,
    });
  }

  private ensureSnapshot(currentState: CurrentGlobalUapkgState, force: boolean) {
    const existing = this.snapshotStore.read();
    if (existing && !force) {
      this.statusPrinter.printSnapshotPreserved(this.snapshotStore.getSnapshotPath());
      return;
    }

    if (currentState.kind === 'link' && this.stateService.isLinkedToWorkspace(currentState) && !force) {
      this.statusPrinter.printAlreadyLinkedToWorkspace();
      if (existing) {
        this.statusPrinter.printSnapshotPreserved(this.snapshotStore.getSnapshotPath());
      }
      return;
    }

    const previous = this.mapStateToSnapshot(currentState);
    if (previous.kind === 'external-link') {
      this.statusPrinter.printExternalLinkDetected(previous.path);
    }

    this.snapshotStore.write(previous);
    this.statusPrinter.printSnapshotCreated(this.snapshotStore.getSnapshotPath());
  }

  private unlinkWithoutSnapshot(force: boolean) {
    const current = this.stateService.detectCurrentState();

    if (this.stateService.isLinkedToWorkspace(current)) {
      this.stateService.removeGlobalUapkg(true);
      this.shimService.removeWorkspaceGlobalShims();
      return;
    }

    if (force) {
      this.stateService.removeGlobalUapkg(true);
      this.shimService.removeWorkspaceGlobalShims();
      return;
    }

    if (current.kind === 'none') {
      this.shimService.removeWorkspaceGlobalShims();
      return;
    }

    this.statusPrinter.printUnlinkRefusedWithoutForce();
  }

  private restoreFromSnapshot(previous: SavedGlobalUapkgState) {
    if (previous.kind === 'none') {
      return;
    }

    if (previous.kind === 'published') {
      this.stateService.installPublishedGlobal(previous.version);
      return;
    }

    this.statusPrinter.printExternalLinkNotRestored(previous.path);
  }

  private mapStateToSnapshot(currentState: CurrentGlobalUapkgState): SavedGlobalUapkgState {
    if (currentState.kind === 'none') {
      return { kind: 'none' };
    }

    if (currentState.kind === 'published') {
      return {
        kind: 'published',
        version: currentState.version,
      };
    }

    if (this.stateService.isLinkedToWorkspace(currentState)) {
      return { kind: 'none' };
    }

    return {
      kind: 'external-link',
      path: currentState.path,
      restorePolicy: 'do-not-restore',
    };
  }
}
