export interface LockedPackage {
  name: string;
  version: string;
  hash: string;
  source: string;
  dependencies: string[];
}

export interface UAPMLockfile {
  package: LockedPackage[];
}
