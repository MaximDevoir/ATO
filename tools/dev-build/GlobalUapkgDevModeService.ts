import type { BuildService } from './BuildService';
import type { DevBuildStatusPrinter } from './DevBuildStatusPrinter';
import type { GlobalUapkgSnapshotStore } from './GlobalUapkgSnapshotStore';
import type { GlobalUapkgStateService } from './GlobalUapkgStateService';
import type { CurrentGlobalUapkgState, SavedGlobalUapkgState } from './types';

export class GlobalUapkgDevModeService {
  constructor(
    private readonly buildService: BuildService,
    private readonly stateService: GlobalUapkgStateService,
    private readonly snapshotStore: GlobalUapkgSnapshotStore,
    private readonly statusPrinter: DevBuildStatusPrinter,
  ) {}

  link(options: { force: boolean }) {
    this.statusPrinter.printLinkStart(options.force);
    const currentState = this.stateService.detectCurrentState();
    this.ensureSnapshot(currentState, options.force);

    this.buildService.buildCliWithDependencies();
    this.stateService.removeGlobalUapkg(true);
    this.stateService.linkCurrentWorkspaceCli();

    this.printStatus();
  }

  unlink(options: { force: boolean }) {
    const snapshot = this.snapshotStore.read();

    if (!snapshot) {
      this.unlinkWithoutSnapshot(options.force);
      this.printStatus();
      return;
    }

    try {
      this.stateService.removeGlobalUapkg(true);
      this.restoreFromSnapshot(snapshot.previous);
      this.snapshotStore.remove();
      this.statusPrinter.printSnapshotRemoved(this.snapshotStore.getSnapshotPath());
    } catch (error) {
      this.statusPrinter.printSnapshotRetainedAfterFailure(this.snapshotStore.getSnapshotPath());
      throw error;
    }

    this.printStatus();
  }

  printStatus() {
    const snapshot = this.snapshotStore.read();
    const current = this.stateService.detectCurrentState();
    const isLinkedToWorkspace = this.stateService.isLinkedToWorkspace(current);
    const binaryPath = this.stateService.resolveBinaryPath();

    this.statusPrinter.printStatus({
      snapshotPath: this.snapshotStore.getSnapshotPath(),
      snapshot,
      current,
      isLinkedToWorkspace,
      binaryPath,
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
      return;
    }

    if (force) {
      this.stateService.removeGlobalUapkg(true);
      return;
    }

    if (current.kind === 'none') {
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
