export type UapkgPackageId =
  'uapkg'
  | '@uapkg/config'
  | '@uapkg/log'
  | '@uapkg/pack'
  | '@uapkg/diagnostics'
  | '@uapkg/diagnostics-format'
  | '@uapkg/common'
  | '@uapkg/common-schema'
  | '@uapkg/registry-schema'
  | '@uapkg/registry-core'
  | '@uapkg/package-manifest-schema'
  | '@uapkg/package-manifest'
  ;

export type DevBuildMode = 'build' | 'devOnce' | 'devWatch';

export interface WorkspacePackage {
  id: UapkgPackageId;
  projectName: string;
  directory: string;
}
