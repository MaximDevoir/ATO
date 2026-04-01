import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CreateATCHarness } from '../src/app/CreateATCHarness';
import { HarnessResultState } from '../src/domain/HarnessCreationResult';
import type { HarnessCreator } from '../src/harness/HarnessCreator';
import { parseAndValidateATCManifest } from '../src/manifest/ATCManifest';
import type { ManifestSource } from '../src/manifest/ManifestSource';
import type { FileSystem } from '../src/services/FileSystem';
import { OutputDirectoryGuard } from '../src/services/OutputDirectoryGuard';
import type { LiveStatusModelLike } from '../src/ui/LiveStatusModel';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Helper to conditionally run describe blocks
function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

describe('ATC manifest validation', () => {
  it('accepts plugin manifests with harness', () => {
    const manifest = parseAndValidateATCManifest(
      JSON.stringify({ type: 'plugin', harness: 'EngineTemplate' }),
      'atc.json',
    );
    expect(manifest.type).toBe('plugin');
    expect(manifest.harness).toBe('EngineTemplate');
  });

  it('fails when type is not plugin', () => {
    expect(() =>
      parseAndValidateATCManifest(JSON.stringify({ type: 'project', harness: 'EngineTemplate' }), 'atc.json'),
    ).toThrow(/type: "plugin"/i);
  });

  it('fails when harness is missing', () => {
    expect(() => parseAndValidateATCManifest(JSON.stringify({ type: 'plugin' }), 'atc.json')).toThrow(/harness/i);
  });
});

describe('OutputDirectoryGuard', () => {
  function createFakeFs(root: string, harness: string, pluginFile: string): FileSystem {
    return {
      exists: (filePath) => filePath === root || filePath === harness,
      isDirectory: () => true,
      readText: () => '',
      writeText: () => {},
      ensureDirectory: () => {},
      listFiles: (directoryPath) => (directoryPath === root ? [pluginFile] : []),
      listEntries: () => [],
      copyDirectory: () => {},
      removeDirectory: () => {},
      createTemporaryDirectory: () => '/tmp/atc',
    };
  }

  describeIf(isWindows)('Windows paths', () => {
    it('rejects directories inside Unreal plugin trees (Windows)', () => {
      const root = 'C:\\Workspace\\PluginRoot';
      const harness = 'C:\\Workspace\\PluginRoot\\Harness';

      const fakeFs = createFakeFs(root, harness, 'MyPlugin.uplugin');
      const guard = new OutputDirectoryGuard(fakeFs);

      expect(() => guard.validate(harness)).toThrow(/inside unreal project\/plugin tree/i);
    });
  });

  describeIf(isMac)('macOS paths', () => {
    it('rejects directories inside Unreal plugin trees (macOS)', () => {
      const root = '/Users/dev/Workspace/PluginRoot';
      const harness = '/Users/dev/Workspace/PluginRoot/Harness';

      const fakeFs = createFakeFs(root, harness, 'MyPlugin.uplugin');
      const guard = new OutputDirectoryGuard(fakeFs);

      expect(() => guard.validate(harness)).toThrow(/inside unreal project\/plugin tree/i);
    });
  });

  describeIf(isLinux)('Linux paths', () => {
    it('rejects directories inside Unreal plugin trees (Linux)', () => {
      const root = '/home/dev/workspace/PluginRoot';
      const harness = '/home/dev/workspace/PluginRoot/Harness';

      const fakeFs = createFakeFs(root, harness, 'MyPlugin.uplugin');
      const guard = new OutputDirectoryGuard(fakeFs);

      expect(() => guard.validate(harness)).toThrow(/inside unreal project\/plugin tree/i);
    });
  });
});

describe('CreateATCHarness', () => {
  it('uses forced --harness creator by name', async () => {
    const calledCreators: string[] = [];
    const manifestSource: ManifestSource = {
      name: 'TestManifestSource',
      canAcceptManifestString: () => true,
      resolveManifest: async () => ({
        manifestDirectory: 'C:\\Plugin',
        manifestFilePath: 'C:\\Plugin\\atc.json',
        manifest: { type: 'plugin', harness: 'Git' },
        installPlugin: () => {},
      }),
    };

    const engineCreator: HarnessCreator = {
      name: 'EngineTemplate',
      canAcceptHarness: () => true,
      executeHarnessCreation: async () => {
        calledCreators.push('EngineTemplate');
      },
    };

    const gitCreator: HarnessCreator = {
      name: 'Git',
      canAcceptHarness: () => true,
      executeHarnessCreation: async () => {
        calledCreators.push('Git');
      },
    };

    const app = new CreateATCHarness(
      {
        manifestString: 'anything',
        outputRootDirectory: 'C:\\Harness',
        harness: 'EngineTemplate',
        argv: {},
        rawArgv: [],
      },
      {
        manifestSources: [manifestSource],
        harnessCreators: [engineCreator, gitCreator],
        fileSystem: createPermissiveFileSystem(),
        outputDirectoryGuard: { validate: () => {} },
        // biome-ignore lint/suspicious/noExplicitAny: use `any` as mock
        engineDirectoryResolver: { resolve: async () => ({}) } as any,
        terminal: { start: () => {}, stop: () => {}, getModel: () => createFakeLiveStatusModel() },
      },
    );

    const result = await app.run();
    expect(result.result).toBe(HarnessResultState.Success);
    expect(calledCreators).toEqual(['EngineTemplate']);
  });

  it('derives outputRootDirectory from atc.json name when omitted', async () => {
    let createdRoot = '';
    const manifestSource: ManifestSource = {
      name: 'TestManifestSource',
      canAcceptManifestString: () => true,
      resolveManifest: async () => ({
        manifestDirectory: 'C:\\Plugin',
        manifestFilePath: 'C:\\Plugin\\atc.json',
        manifest: { type: 'plugin', harness: 'Git', name: 'SamplePlugin' },
        installPlugin: () => {},
      }),
    };

    const gitCreator: HarnessCreator = {
      name: 'Git',
      canAcceptHarness: () => true,
      executeHarnessCreation: async (settings) => {
        createdRoot = settings.rootFolder;
      },
    };

    const app = new CreateATCHarness(
      {
        manifestString: 'anything',
        argv: {},
        rawArgv: [],
      },
      {
        manifestSources: [manifestSource],
        harnessCreators: [gitCreator],
        fileSystem: createPermissiveFileSystem(),
        outputDirectoryGuard: { validate: () => {} },
        // biome-ignore lint/suspicious/noExplicitAny: use `any` as mock
        engineDirectoryResolver: { resolve: async () => ({}) } as any,
        terminal: { start: () => {}, stop: () => {}, getModel: () => createFakeLiveStatusModel() },
      },
    );

    const result = await app.run();
    expect(result.result).toBe(HarnessResultState.Success);
    expect(path.basename(createdRoot)).toBe('SamplePluginHarness');
  });

  it('falls back to uplugin file stem when manifest name is missing', async () => {
    let createdRoot = '';
    const pluginDirectory = path.resolve('PluginRoot');
    const pluginFile = path.join(pluginDirectory, 'FallbackPlugin.uplugin');
    const manifestSource: ManifestSource = {
      name: 'TestManifestSource',
      canAcceptManifestString: () => true,
      resolveManifest: async () => ({
        manifestDirectory: pluginDirectory,
        manifestFilePath: path.join(pluginDirectory, 'atc.json'),
        manifest: { type: 'plugin', harness: 'Git' },
        installPlugin: () => {},
      }),
    };

    const gitCreator: HarnessCreator = {
      name: 'Git',
      canAcceptHarness: () => true,
      executeHarnessCreation: async (settings) => {
        createdRoot = settings.rootFolder;
      },
    };

    const app = new CreateATCHarness(
      {
        manifestString: 'anything',
        argv: {},
        rawArgv: [],
      },
      {
        manifestSources: [manifestSource],
        harnessCreators: [gitCreator],
        fileSystem: createFileSystemWithPluginFile(pluginDirectory, pluginFile),
        outputDirectoryGuard: { validate: () => {} },
        // biome-ignore lint/suspicious/noExplicitAny: use `any` as mock
        engineDirectoryResolver: { resolve: async () => ({}) } as any,
        terminal: { start: () => {}, stop: () => {}, getModel: () => createFakeLiveStatusModel() },
      },
    );

    const result = await app.run();
    expect(result.result).toBe(HarnessResultState.Success);
    expect(path.basename(createdRoot)).toBe('FallbackPluginHarness');
  });
});

function createPermissiveFileSystem(): FileSystem {
  return {
    exists: () => true,
    isDirectory: () => true,
    readText: () => '',
    writeText: () => {},
    ensureDirectory: () => {},
    listFiles: () => [],
    listEntries: () => [],
    copyDirectory: () => {},
    removeDirectory: () => {},
    createTemporaryDirectory: () => 'C:\\tmp\\atc',
  };
}

function createFileSystemWithPluginFile(pluginDirectory: string, pluginFile: string): FileSystem {
  return {
    exists: () => true,
    isDirectory: (filePath) => filePath === pluginDirectory,
    readText: () => '',
    writeText: () => {},
    ensureDirectory: () => {},
    listFiles: () => [],
    listEntries: (directoryPath) => (directoryPath === pluginDirectory ? [pluginFile] : []),
    copyDirectory: () => {},
    removeDirectory: () => {},
    createTemporaryDirectory: () => 'C:\\tmp\\atc',
  };
}

function createFakeLiveStatusModel(): LiveStatusModelLike {
  return {
    subscribe: () => () => {},
    getSnapshot: () => ({ logs: [], warnings: [], errors: [] }),
    setStatus: () => {},
    addLog: () => {},
    addWarning: () => {},
    addError: () => {},
    setCustomElement: () => {},
  };
}
