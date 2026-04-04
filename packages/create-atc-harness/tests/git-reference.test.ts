import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HarnessCreationResult } from '../src/domain/HarnessCreationResult';
import { HarnessCreationSettings } from '../src/domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../src/domain/LiveStatusHandle';
import { GitHarnessCreator } from '../src/harness/GitHarnessCreator';
import { GitManifestSource } from '../src/manifest/GitManifestSource';
import type { FileSystem } from '../src/services/FileSystem';
import type { GitService } from '../src/services/GitService';
import { parseGitReference } from '../src/services/GitUrl';

describe('parseGitReference', () => {
  it('parses @tag suffix for https repository', () => {
    const parsed = parseGitReference('https://github.com/org/repo.git@5.7.3');
    expect(parsed.repositoryUrl).toBe('https://github.com/org/repo.git');
    expect(parsed.ref).toBe('5.7.3');
  });

  it('parses #ref suffix', () => {
    const parsed = parseGitReference('https://github.com/org/repo.git#release/v1');
    expect(parsed.repositoryUrl).toBe('https://github.com/org/repo.git');
    expect(parsed.ref).toBe('release/v1');
  });

  it('normalizes git+https urls', () => {
    const parsed = parseGitReference('git+https://github.com/org/repo.git@v2');
    expect(parsed.repositoryUrl).toBe('https://github.com/org/repo.git');
    expect(parsed.ref).toBe('v2');
  });
});

describe('git clone with tag/ref', () => {
  it('passes parsed ref to GitHarnessCreator clone call', async () => {
    const cloneCalls: Array<{ repository: string; destinationDirectory: string; ref?: string }> = [];
    const gitService: GitService = {
      isGitAvailable: () => true,
      clone: async (repository, destinationDirectory, ref) => {
        cloneCalls.push({ repository, destinationDirectory, ref });
      },
      hasLfsTracking: () => false,
      isGitLfsAvailable: () => true,
      pullLfs: async () => {},
    };

    const creator = new GitHarnessCreator(gitService);
    await creator.executeHarnessCreation(
      new HarnessCreationSettings({
        rootFolder: '/tmp/harness',
        pluginManifestFolder: '/tmp/plugin',
        harnessString: 'https://github.com/org/harness.git@5.7.3',
        commandLineOptions: {
          manifestString: '/tmp/plugin/uapkg.json',
          outputRootDirectory: '/tmp/harness',
          argv: {},
          rawArgv: [],
        },
      }),
      new HarnessCreationResult(),
      createNoopLiveStatusHandle(),
    );

    expect(cloneCalls).toEqual([
      {
        repository: 'https://github.com/org/harness.git',
        destinationDirectory: path.resolve('/tmp/harness'),
        ref: '5.7.3',
      },
    ]);
  });

  it('passes parsed ref to GitManifestSource clone call', async () => {
    const cloneCalls: Array<{ repository: string; destinationDirectory: string; ref?: string }> = [];
    const gitService: GitService = {
      isGitAvailable: () => true,
      clone: async (repository, destinationDirectory, ref) => {
        cloneCalls.push({ repository, destinationDirectory, ref });
      },
      hasLfsTracking: () => false,
      isGitLfsAvailable: () => true,
      pullLfs: async () => {},
    };

    const fakeFs: FileSystem = {
      exists: (filePath) => filePath.endsWith('uapkg.json'),
      isDirectory: () => true,
      readText: () => JSON.stringify({ type: 'plugin', harness: 'EngineTemplate' }),
      writeText: () => {},
      ensureDirectory: () => {},
      listFiles: () => [],
      listEntries: () => [],
      copyDirectory: () => {},
      removeDirectory: () => {},
      createTemporaryDirectory: () => '/tmp/manifest-repo',
    };

    const source = new GitManifestSource(fakeFs, gitService);
    await source.resolveManifest(
      {
        manifestString: 'https://github.com/org/plugin.git@release-5.7.3',
        outputRootDirectory: '/tmp/out',
      },
      new HarnessCreationResult(),
      createNoopLiveStatusHandle(),
    );

    expect(cloneCalls).toEqual([
      {
        repository: 'https://github.com/org/plugin.git',
        destinationDirectory: '/tmp/manifest-repo',
        ref: 'release-5.7.3',
      },
    ]);
  });

  it('installs plugin into Plugins/<manifest.name> when name exists', async () => {
    const copyCalls: Array<{ from: string; to: string }> = [];
    const gitService: GitService = {
      isGitAvailable: () => true,
      clone: async () => {},
      hasLfsTracking: () => false,
      isGitLfsAvailable: () => true,
      pullLfs: async () => {},
    };

    const fakeFs: FileSystem = {
      exists: (filePath) => filePath.endsWith('uapkg.json'),
      isDirectory: () => false,
      readText: () => JSON.stringify({ type: 'plugin', harness: 'EngineTemplate', name: 'AwesomeInventory' }),
      writeText: () => {},
      ensureDirectory: () => {},
      listFiles: () => [],
      listEntries: (directoryPath) =>
        path.normalize(directoryPath) === path.normalize('/tmp/manifest-repo')
          ? [path.normalize('/tmp/manifest-repo/AwesomeInventory.uplugin')]
          : [],
      copyDirectory: (from, to) => {
        copyCalls.push({ from, to });
      },
      removeDirectory: () => {},
      createTemporaryDirectory: () => '/tmp/manifest-repo',
    };

    const source = new GitManifestSource(fakeFs, gitService);
    const resolution = await source.resolveManifest(
      {
        manifestString: 'https://github.com/org/plugin.git@release-5.7.3',
        outputRootDirectory: '/tmp/out',
      },
      new HarnessCreationResult(),
      createNoopLiveStatusHandle(),
    );

    resolution.installPlugin(
      new HarnessCreationSettings({
        rootFolder: '/tmp/host',
        pluginManifestFolder: '/tmp/manifest-repo',
        harnessString: 'EngineTemplate',
        commandLineOptions: {
          manifestString: '/tmp/manifest-repo/uapkg.json',
          outputRootDirectory: '/tmp/host',
          argv: {},
          rawArgv: [],
        },
      }),
    );

    expect(copyCalls).toEqual([
      {
        from: path.normalize('/tmp/manifest-repo'),
        to: path.join(path.resolve('/tmp/host'), 'Plugins', 'AwesomeInventory'),
      },
    ]);
  });

  it('falls back to uplugin filename when manifest.name is missing', async () => {
    const copyCalls: Array<{ from: string; to: string }> = [];
    const gitService: GitService = {
      isGitAvailable: () => true,
      clone: async () => {},
      hasLfsTracking: () => false,
      isGitLfsAvailable: () => true,
      pullLfs: async () => {},
    };

    const fakeFs: FileSystem = {
      exists: (filePath) => filePath.endsWith('uapkg.json'),
      isDirectory: () => false,
      readText: () => JSON.stringify({ type: 'plugin', harness: 'EngineTemplate' }),
      writeText: () => {},
      ensureDirectory: () => {},
      listFiles: () => [],
      listEntries: (directoryPath) =>
        path.normalize(directoryPath) === path.normalize('/tmp/manifest-repo')
          ? [path.normalize('/tmp/manifest-repo/AwesomeInventory.uplugin')]
          : [],
      copyDirectory: (from, to) => {
        copyCalls.push({ from, to });
      },
      removeDirectory: () => {},
      createTemporaryDirectory: () => '/tmp/manifest-repo',
    };

    const source = new GitManifestSource(fakeFs, gitService);
    const resolution = await source.resolveManifest(
      {
        manifestString: 'https://github.com/org/plugin.git@release-5.7.3',
        outputRootDirectory: '/tmp/out',
      },
      new HarnessCreationResult(),
      createNoopLiveStatusHandle(),
    );

    resolution.installPlugin(
      new HarnessCreationSettings({
        rootFolder: '/tmp/host',
        pluginManifestFolder: '/tmp/manifest-repo',
        harnessString: 'EngineTemplate',
        commandLineOptions: {
          manifestString: '/tmp/manifest-repo/uapkg.json',
          outputRootDirectory: '/tmp/host',
          argv: {},
          rawArgv: [],
        },
      }),
    );

    expect(copyCalls).toEqual([
      {
        from: path.normalize('/tmp/manifest-repo'),
        to: path.join(path.resolve('/tmp/host'), 'Plugins', 'AwesomeInventory'),
      },
    ]);
  });
});

function createNoopLiveStatusHandle(): LiveStatusHandle {
  return {
    setStatus: () => {},
    addLog: () => {},
    addWarning: () => {},
    addError: () => {},
    setCustomElement: () => {},
  };
}
