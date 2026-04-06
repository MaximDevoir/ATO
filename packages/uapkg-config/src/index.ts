import { ConfigInstance } from './core/ConfigInstance';
import { createConfig } from './factory/createConfig';

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
  ResolvedConfig,
} from './contracts/ConfigTypes';
export { ConfigInstance, createConfig };
