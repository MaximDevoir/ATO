export interface LockedPackage {
  name: string;
  version: string;
  hash: string;
  source: string;
  dependencies: string[];
  harnessed?: boolean;
}

export interface UAPKGLockfile {
  package: LockedPackage[];
}
