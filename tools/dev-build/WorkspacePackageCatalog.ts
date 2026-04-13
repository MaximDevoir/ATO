import path from 'node:path';
import type { WorkspacePackage } from './contracts';

export class WorkspacePackageCatalog {
  constructor(private readonly workspaceRoot: string) {}

  listUapkgPackages(): WorkspacePackage[] {
    return [
      {
        id: 'uapkg',
        projectName: 'uapkg',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg'),
      },
      {
        id: '@uapkg/config',
        projectName: 'uapkg-config',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-config'),
      },
      {
        id: '@uapkg/log',
        projectName: 'uapkg-log',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-log'),
      },
      {
        id: '@uapkg/pack',
        projectName: 'uapkg-pack',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-pack'),
      },
      {
        id: '@uapkg/diagnostics',
        projectName: 'uapkg-diagnostics',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-diagnostics'),
      },
      {
        id: '@uapkg/diagnostics-format',
        projectName: 'uapkg-diagnostics-format',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-diagnostics-format'),
      },
      {
        id: '@uapkg/common',
        projectName: 'uapkg-common',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-common'),
      },
      {
        id: '@uapkg/common-schema',
        projectName: 'uapkg-common-schema',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-common-schema'),
      },
      {
        id: '@uapkg/registry-schema',
        projectName: 'uapkg-registry-schema',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-registry-schema'),
      },
      {
        id: '@uapkg/registry-core',
        projectName: 'uapkg-registry-core',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-registry-core'),
      },
      {
        id: '@uapkg/package-manifest-schema',
        projectName: 'uapkg-package-manifest-schema',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-package-manifest-schema'),
      },
      {
        id: '@uapkg/package-manifest',
        projectName: 'uapkg-package-manifest',
        directory: path.join(this.workspaceRoot, 'packages', 'uapkg-package-manifest'),
      },
    ];
  }
}
