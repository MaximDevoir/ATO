import type { ConfigCreateOptions } from '../contracts/ConfigTypes';
import { ConfigInstance } from '../core/ConfigInstance';

export function createConfig(options: ConfigCreateOptions = {}) {
  return new ConfigInstance(options);
}
