import type { ConfigCreateOptions } from '../contracts/ConfigTypes.js';
import { ConfigInstance } from '../core/ConfigInstance.js';

export function createConfig(options: ConfigCreateOptions = {}) {
  return new ConfigInstance(options);
}
