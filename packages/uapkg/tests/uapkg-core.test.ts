import { describe, expect, it } from 'vitest';
import { AddCommand } from '../src/commands/AddCommand';
import { InitCommand } from '../src/commands/InitCommand';
import type { UAPKGManifest } from '../src/domain/UAPKGManifest';
import { UAPKGManifestSchema } from '../src/domain/UAPKGManifest';
import { parseGitReference } from '../src/services/GitReferenceParser';

describe('parseGitReference', () => {
  it('parses @tag refs', () => {
    const parsed = parseGitReference('https://github.com/org/repo.git@v5.7.3');
    expect(parsed.repositoryUrl).toBe('https://github.com/org/repo.git');
    expect(parsed.ref).toBe('v5.7.3');
  });
});

describe('InitCommand', () => {
  it('creates manifest using detected defaults in non-interactive prompt service', async () => {
    let writtenManifest: UAPKGManifest | undefined;
    const repository = {
      exists: () => false,
      read: () => {
        throw new Error('not used');
      },
      write: (_cwd: string, manifest: UAPKGManifest) => {
        writtenManifest = manifest;
      },
      getManifestPath: () => 'uapkg.json',
    };

    const command = new InitCommand(
      { cwd: 'C:\\Workspace' },
      repository,
      // biome-ignore lint/suspicious/noExplicitAny: Cast `any` during mock
      { detect: () => ({ suggestedType: 'plugin' as const, suggestedName: 'AwesomeInventory' }) } as any,
      {
        // biome-ignore lint/suspicious/noExplicitAny: Cast `any` during mock
        select: async (_message: string, _options: any[], fallback: string) => fallback,
        text: async (_message: string, initialValue: string) => initialValue,
      },
      { info: () => {}, warn: () => {}, error: () => {} },
    );

    await command.execute();
    expect(writtenManifest).toEqual({
      name: 'AwesomeInventory',
      type: 'plugin',
      dependencies: [],
    });
  });
});

describe('AddCommand', () => {
  it('adds semver tag dependency with caret version', async () => {
    const initialManifest: UAPKGManifest = {
      name: 'MyGame',
      type: 'project',
      dependencies: [],
    };
    let writtenManifest: UAPKGManifest | undefined;
    const repository = {
      exists: () => true,
      getManifestPath: () => 'uapkg.json',
      read: (cwd: string) =>
        cwd.includes('uapkg-add-temp')
          ? ({
              name: 'AwesomeInventory',
              type: 'plugin',
              dependencies: [],
            } as UAPKGManifest)
          : initialManifest,
      write: (_cwd: string, manifest: UAPKGManifest) => {
        writtenManifest = manifest;
      },
    };

    await new AddCommand(
      {
        cwd: 'C:\\Workspace',
        source: 'https://github.com/org/AwesomeInventory.git@v5.7.3',
        force: false,
        pin: false,
        harnessed: false,
      },
      repository,
      {
        getPath: () => 'uapkg.lock',
        exists: () => false,
        read: () => ({ package: [] }),
        write: () => {},
      },
      {
        resolve: (...segments: string[]) => segments.join('\\'),
        createTempDir: () => 'uapkg-add-temp',
        removeDir: () => {},
        copyDir: () => {},
        exists: () => true,
        ensureDir: () => {},
        listEntries: () => [],
      },
      {
        clone: async () => {},
        addSubmodule: async () => {},
        listRemoteRefs: async () => [],
        resolveRef: async () => ({ version: 'v5.7.3', hash: 'abc123' }),
        inspectRepository: async () => ({ isRepository: false, isDirty: false }),
        checkout: async () => {},
        fetch: async () => {},
      },
      { info: () => {}, warn: () => {}, error: () => {} },
    ).execute();

    expect(writtenManifest?.dependencies).toEqual([
      {
        name: 'AwesomeInventory',
        source: 'https://github.com/org/AwesomeInventory.git',
        version: '^5.7.3',
      },
    ]);
  });
});

describe('UAPKGManifestSchema', () => {
  it('rejects postinstall for plugin manifests', () => {
    expect(() =>
      UAPKGManifestSchema.parse({
        name: 'AwesomeInventory',
        type: 'plugin',
        postinstall: {
          modules: ['MyGame'],
        },
      }),
    ).toThrow(/postinstall is only valid for project manifests/i);
  });
});
