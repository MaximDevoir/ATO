import { describe, expect, it } from 'vitest';
import { CreateATCHarness } from '../src/app/CreateATCHarness';
import { HarnessResultState } from '../src/domain/HarnessCreationResult';
import type { HarnessCreator } from '../src/harness/HarnessCreator';
import { parseAndValidateATCManifest } from '../src/manifest/ATCManifest';
import type { ManifestSource } from '../src/manifest/ManifestSource';
import type { FileSystem } from '../src/services/FileSystem';
import { OutputDirectoryGuard } from '../src/services/OutputDirectoryGuard';
import type { LiveStatusModelLike } from '../src/ui/LiveStatusModel';

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
  it('rejects directories inside Unreal plugin trees', () => {
    const fakeFs: FileSystem = {
      exists: (filePath) =>
        filePath === 'C:\\Workspace\\PluginRoot' || filePath === 'C:\\Workspace\\PluginRoot\\Harness',
      isDirectory: () => true,
      readText: () => '',
      writeText: () => {},
      ensureDirectory: () => {},
      listFiles: (directoryPath) => (directoryPath === 'C:\\Workspace\\PluginRoot' ? ['MyPlugin.uplugin'] : []),
      listEntries: () => [],
      copyDirectory: () => {},
      removeDirectory: () => {},
      createTemporaryDirectory: () => 'C:\\tmp\\atc',
    };

    const guard = new OutputDirectoryGuard(fakeFs);
    expect(() => guard.validate('C:\\Workspace\\PluginRoot\\Harness')).toThrow(/inside unreal project\/plugin tree/i);
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
