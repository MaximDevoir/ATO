import { createHash } from 'node:crypto';

export function getPluginHash(pluginName: string) {
  const hash = createHash('sha1').update(pluginName).digest('hex');
  return hash.slice(0, 8).toLowerCase();
}

export function getWrapperClassName(pluginName: string) {
  return `UAPM_${getPluginHash(pluginName)}`;
}
