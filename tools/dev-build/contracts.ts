export type UapkgPackageId = 'uapkg' | '@uapkg/config' | '@uapkg/log' | '@uapkg/pack';

export type DevBuildMode = 'build' | 'devOnce' | 'devWatch';

export interface WorkspacePackage {
  id: UapkgPackageId;
  projectName: string;
  directory: string;
}