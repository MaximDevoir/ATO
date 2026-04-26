import type { UnrealLagOptions } from './types.js';

const exampleConfig: UnrealLagOptions = {
  bindAddress: '127.0.0.1',
  bindPort: 7000,
  server: {
    address: '127.0.0.1',
    port: 7777,
    selection: {
      profile: 'Good',
    },
  },
  defaultClient: {
    profile: 'Good',
  },
  randomSeed: 1337,
  autoCreateClients: true,
  verboseDebug: false,
};

export function getExampleConfig(): UnrealLagOptions {
  return {
    ...exampleConfig,
    server: {
      ...exampleConfig.server,
      selection: exampleConfig.server.selection ? { ...exampleConfig.server.selection } : undefined,
    },
    defaultClient: exampleConfig.defaultClient ? { ...exampleConfig.defaultClient } : undefined,
  };
}

export { exampleConfig };
