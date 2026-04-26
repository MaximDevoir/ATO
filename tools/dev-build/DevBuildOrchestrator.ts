import { BuildService } from './BuildService';
import { DevBuildStatusPrinter } from './DevBuildStatusPrinter';
import { GlobalCommandShimService } from './GlobalCommandShimService';
import { GlobalUapkgDevModeService } from './GlobalUapkgDevModeService';
import { GlobalUapkgSnapshotStore } from './GlobalUapkgSnapshotStore';
import { GlobalUapkgStateService } from './GlobalUapkgStateService';
import { ProcessRunner } from './ProcessRunner';

export class DevBuildOrchestrator {
  private readonly buildService: BuildService;
  private readonly devModeService: GlobalUapkgDevModeService;

  constructor(private readonly workspaceRoot: string) {
    const runner = new ProcessRunner();
    this.buildService = new BuildService(runner, this.workspaceRoot);

    const stateService = new GlobalUapkgStateService(runner, this.workspaceRoot);
    const snapshotStore = new GlobalUapkgSnapshotStore(this.workspaceRoot);
    const statusPrinter = new DevBuildStatusPrinter();
    const shimService = new GlobalCommandShimService(runner, this.workspaceRoot);
    this.devModeService = new GlobalUapkgDevModeService(
      this.buildService,
      stateService,
      snapshotStore,
      statusPrinter,
      shimService,
    );
  }

  buildAll() {
    this.buildService.buildAll();
  }

  link(options: { force: boolean }) {
    this.devModeService.link(options);
  }

  watch() {
    this.buildService.watchCliAndDependents();
  }

  unlink(options: { force: boolean }) {
    this.devModeService.unlink(options);
  }

  status() {
    this.devModeService.printStatus();
  }
}
