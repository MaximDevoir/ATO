import { BuildService } from './BuildService';
import { GlobalLinkService } from './GlobalLinkService';
import { LocalCommandShimService } from './LocalCommandShimService';
import { ProcessRunner } from './ProcessRunner';
import { WorkspacePackageCatalog } from './WorkspacePackageCatalog';

export class DevBuildOrchestrator {
  private readonly runner: ProcessRunner;
  private readonly catalog: WorkspacePackageCatalog;
  private readonly buildService: BuildService;
  private readonly linkService: GlobalLinkService;
  private readonly shimService: LocalCommandShimService;

  constructor(private readonly workspaceRoot: string) {
    this.runner = new ProcessRunner();
    this.catalog = new WorkspacePackageCatalog(this.workspaceRoot);
    this.buildService = new BuildService(this.runner, this.workspaceRoot);
    this.linkService = new GlobalLinkService(this.runner);
    this.shimService = new LocalCommandShimService();
  }

  buildAll() {
    const packages = this.catalog.listUapkgPackages();
    this.buildService.buildAll(packages.map((workspacePackage) => workspacePackage.projectName));
  }

  buildAndRelinkAllOnce() {
    const packages = this.catalog.listUapkgPackages();
    this.buildAll();

    for (const workspacePackage of packages) {
      this.linkService.relinkPackage(workspacePackage, this.workspaceRoot);
    }

    this.shimService.writeUapkgShims(this.workspaceRoot);
  }

  watchAndRebuildAndRelink() {
    this.runner.run(
      'pnpm',
      [
        'nx',
        'watch',
        '--projects=uapkg,uapkg-config,uapkg-log,uapkg-pack',
        '--includeDependentProjects',
        '--',
        'pnpm',
        'build:devOnce',
      ],
      this.workspaceRoot,
    );
  }
}
