export interface PackOptions {
  cwd?: string;
  outFile?: string;
  dryRun?: boolean;
  allowMissingLfs?: boolean;
}

export interface PackResult {
  pluginRoot: string;
  archivePath: string;
  integrityPath?: string;
  files: string[];
  warnings: string[];
  dryRun: boolean;
}

export interface PackManifest {
  name: string;
  version: string;
}

export interface CollectedFile {
  absolutePath: string;
  relativePath: string;
}

export interface IgnoreRuleSet {
  gitRoot: string;
  ruleFiles: string[];
}
