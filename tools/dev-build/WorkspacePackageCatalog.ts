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
    ];
  }
}