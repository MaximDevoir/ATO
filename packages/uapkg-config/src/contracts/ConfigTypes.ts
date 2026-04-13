export type ConfigLayerSource = 'default' | 'global' | 'intermediary' | 'local';

export interface RegistryRef {
  type: 'branch' | 'tag' | 'rev';
  value: string;
}

export interface RegistryConfig {
  url: string;
  ref: RegistryRef;
  ttlSeconds?: number;
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
}
