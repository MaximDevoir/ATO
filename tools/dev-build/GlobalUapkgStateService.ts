import path from 'node:path';
import { PathUtils } from './PathUtils';
import type { ProcessRunner } from './ProcessRunner';
import type { CurrentGlobalUapkgState } from './types';

interface PnpmGlobalDependencyRecord {
  version?: string;
  path?: string;
}

interface PnpmGlobalListRoot {
  dependencies?: Record<string, PnpmGlobalDependencyRecord>;
}

export class GlobalUapkgStateService {
  private readonly pathUtils: PathUtils;

  constructor(
    private readonly runner: ProcessRunner,
    private readonly workspaceRoot: string,
  ) {
    this.pathUtils = new PathUtils();
  }

  getCliPackageDirectory() {
    return path.join(this.workspaceRoot, 'packages', 'uapkg');
  }

  isLinkedToWorkspace(state: CurrentGlobalUapkgState) {
    if (state.kind !== 'link') {
      return false;
    }

    return this.pathUtils.isSamePath(state.path, this.getCliPackageDirectory());
  }

  detectCurrentState(): CurrentGlobalUapkgState {
    const { stdout } = this.runner.runAndCapture(
      'pnpm',
      ['list', '--global', '--depth', '0', '--json'],
      this.workspaceRoot,
    );

    const parsed = this.tryParseList(stdout);
    const dependency = this.findGlobalUapkgDependency(parsed);
    if (!dependency) {
      return { kind: 'none' };
    }

    const version = dependency.version ?? '';
    if (version.startsWith('link:')) {
      const fromVersion = version.slice('link:'.length);
      return {
        kind: 'link',
        path: this.pickLinkPath(dependency.path, fromVersion),
      };
    }

    return {
      kind: 'published',
      version,
    };
  }

  removeGlobalUapkg(ignoreFailure = true) {
    this.runner.runAndCapture('pnpm', ['remove', '--global', 'uapkg'], this.workspaceRoot, { ignoreFailure });
  }

  installPublishedGlobal(version: string) {
    this.runner.run('pnpm', ['add', '--global', `uapkg@${version}`], this.workspaceRoot);
  }

  linkCurrentWorkspaceCli() {
    this.runner.run('pnpm', ['link', '--global'], this.getCliPackageDirectory());
  }

  resolveBinaryPath() {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const result = this.runner.runAndCapture(command, ['uapkg'], this.workspaceRoot, { ignoreFailure: true });
    const firstLine = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    return firstLine ?? null;
  }

  private tryParseList(rawJson: string): PnpmGlobalListRoot[] {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as PnpmGlobalListRoot[];
    } catch {
      return [];
    }
  }

  private findGlobalUapkgDependency(roots: PnpmGlobalListRoot[]) {
    for (const root of roots) {
      const dependency = root.dependencies?.uapkg;
      if (dependency) {
        return dependency;
      }
    }

    return null;
  }

  private pickLinkPath(dependencyPath: string | undefined, fromVersion: string) {
    if (fromVersion.length > 0) {
      return fromVersion;
    }

    if (dependencyPath) {
      return dependencyPath;
    }

    return this.getCliPackageDirectory();
  }
}
