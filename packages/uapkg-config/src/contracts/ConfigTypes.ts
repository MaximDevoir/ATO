import type { Diagnostic } from '@uapkg/diagnostics';

export type ConfigLayerSource = 'default' | 'global' | 'intermediary' | 'local';

export interface RegistryRef {
  type: 'branch' | 'tag' | 'rev';
  value: string;
}

export type PostInstallPolicyValue = 'allow' | 'deny';

export interface RegistryConfig {
  url: string;
  ref: RegistryRef;
  ttlSeconds?: number;
  /** Per-registry override of `install.postInstallPolicy`. */
  postInstallPolicy?: PostInstallPolicyValue;
}

export interface ResolvedConfig {
  registry: string;
  registries: Record<string, RegistryConfig>;
  git: string;
  editor: string;
  exec: {
    shell: string;
  };
  cache: {
    enabled: boolean;
  };
  registryCache: {
    ttlSeconds: number;
  };
  network: {
    retries: number;
    timeout: number;
    /** Maximum simultaneous asset downloads. Default: 5. */
    maxConcurrentDownloads: number;
  };
  install: {
    /** Global postinstall policy. Default: `deny`. */
    postInstallPolicy: PostInstallPolicyValue;
  };
  term: {
    quiet: boolean;
    verbose: boolean;
  };
}

export type ConfigValue = unknown;

export interface ConfigLayer {
  source: ConfigLayerSource;
  file?: string;
  values: Record<string, unknown>;
}

export interface ConfigValueWithOrigin {
  value: ConfigValue;
  source: ConfigLayerSource;
  file?: string;
}

export interface ConfigTraceEntry {
  source: ConfigLayerSource;
  value: ConfigValue;
  file?: string;
}

export type ConfigScope = 'global' | 'local';

export interface ConfigReloadOptions {
  cwd?: string;
}

export interface ConfigCreateOptions {
  cwd?: string;
}

export interface ConfigGetOptions {
  scope?: ConfigScope;
}

export interface ConfigListOptions {
  scope?: ConfigScope;
}

export interface ConfigWriteOptions {
  scope?: ConfigScope;
}

export interface ConfigPaths {
  cwd: string;
  manifestRoot: string;
  globalFile: string;
  localFile: string;
  intermediaryFiles: string[];
}

export interface ConfigReadResult {
  values: Record<string, unknown>;
  exists: boolean;
  diagnostics: readonly Diagnostic[];
}

export interface ConfigLayerBuildResult {
  layers: ConfigLayer[];
  diagnostics: readonly Diagnostic[];
}

export interface ConfigResolvedResult {
  value: Record<string, unknown>;
  diagnostics: readonly Diagnostic[];
}
