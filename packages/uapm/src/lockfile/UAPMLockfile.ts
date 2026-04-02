export interface LockedPackage {
  name: string;
  version: string;
  hash: string;
  source: string;
  dependencies: string[];
  harnessed?: boolean;
}

export interface UAPMLockfile {
  package: LockedPackage[];
}
