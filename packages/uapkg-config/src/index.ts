import { ConfigInstance } from './core/ConfigInstance.js';
import { createConfig } from './factory/createConfig.js';

const singleton = new ConfigInstance({ cwd: process.cwd() });

const Config = {
  get(pathToProperty?: string, options?: { scope?: 'global' | 'local' }) {
    return singleton.get(pathToProperty, options);
  },
  getAll(options?: { scope?: 'global' | 'local' }) {
    return singleton.getAll(options);
  },
  getDefaultRegistry() {
    return singleton.getDefaultRegistry();
  },
  getWithOrigin(pathToProperty: string) {
    return singleton.getWithOrigin(pathToProperty);
  },
  trace(pathToProperty: string) {
    return singleton.trace(pathToProperty);
  },
  reload(options?: { cwd?: string }) {
    singleton.reload(options);
    return Config;
  },
};

export default Config;
export type {
  ConfigCreateOptions,
  ConfigTraceEntry,
  ConfigValueWithOrigin,
  PostInstallPolicyValue,
  RegistryConfig,
  RegistryRef,
  ResolvedConfig,
} from './contracts/ConfigTypes.js';
export { PostInstallPolicyResolver } from './core/PostInstallPolicyResolver.js';
export { ConfigInstance, createConfig };
