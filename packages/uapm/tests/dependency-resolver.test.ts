import { describe, expect, it } from 'vitest';
import type { UAPMManifest } from '../src/domain/UAPMManifest';
import { DependencyResolver } from '../src/graph/DependencyResolver';

describe('DependencyResolver', () => {
  it('throws when same name has multiple sources without pin', async () => {
    const resolver = new DependencyResolver({
      clone: async () => {},
      addSubmodule: async () => {},
      listRemoteRefs: async () => [],
      resolveRef: async () => ({ version: 'HEAD', hash: 'abc' }),
      inspectRepository: async () => ({ isRepository: false, isDirty: false }),
      checkout: async () => {},
      fetch: async () => {},
    });
    const root: UAPMManifest = {
      name: 'Root',
      type: 'project',
      dependencies: [],
    };
    const manifests: UAPMManifest[] = [
      root,
      {
        name: 'A',
        type: 'plugin',
        dependencies: [{ name: 'Shared', source: 'https://github.com/org/shared.git' }],
      },
      {
        name: 'B',
        type: 'plugin',
        dependencies: [{ name: 'Shared', source: 'https://github.com/company/shared.git' }],
      },
    ];

    await expect(resolver.resolve(root, manifests)).rejects.toThrow(/multiple sources/i);
  });

  it('uses pin to resolve conflicting sources', async () => {
    const resolver = new DependencyResolver({
      clone: async () => {},
      addSubmodule: async () => {},
      listRemoteRefs: async () => [],
      resolveRef: async () => ({ version: 'HEAD', hash: 'abc' }),
      inspectRepository: async () => ({ isRepository: false, isDirty: false }),
      checkout: async () => {},
      fetch: async () => {},
    });
    const root: UAPMManifest = {
      name: 'Root',
      type: 'project',
      dependencies: [],
      dependencyPins: [{ name: 'Shared', source: 'https://github.com/company/shared.git', version: '^2.0.0' }],
    };
    const manifests: UAPMManifest[] = [
      root,
      {
        name: 'A',
        type: 'plugin',
        dependencies: [{ name: 'Shared', source: 'https://github.com/org/shared.git', version: '^1.0.0' }],
      },
      {
        name: 'B',
        type: 'plugin',
        dependencies: [{ name: 'Shared', source: 'https://github.com/company/shared.git', version: '^2.0.0' }],
      },
    ];

    const result = await resolver.resolve(root, manifests);
    expect(result.resolvedDependencies).toEqual([
      {
        name: 'Shared',
        source: 'https://github.com/company/shared.git',
        version: '^2.0.0',
        hash: 'abc',
        dependencies: [],
      },
    ]);
  });
});
