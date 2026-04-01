import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EngineAssociationResolver } from '../src/EngineAssociationResolver';
import { coerceInstalledEnginePathToEngineDirectory, isValidEngineDirectory } from '../src/engineValidation';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ear-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createValidEngineDirectory(engineDir: string) {
  fs.mkdirSync(path.join(engineDir, 'Build', 'BatchFiles'), { recursive: true });
  fs.writeFileSync(path.join(engineDir, 'Build', 'BatchFiles', 'RunUAT.bat'), '@echo off\n');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('isValidEngineDirectory', () => {
  it('returns true when RunUAT.bat exists', () => {
    const root = createTemporaryDirectory();
    const engineDir = path.join(root, 'Engine');
    createValidEngineDirectory(engineDir);

    expect(isValidEngineDirectory(engineDir)).toBe(true);
  });

  it('returns false for an empty directory', () => {
    const root = createTemporaryDirectory();
    expect(isValidEngineDirectory(root)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidEngineDirectory('')).toBe(false);
  });
});

describe('coerceInstalledEnginePathToEngineDirectory', () => {
  it('returns the path directly when it is a valid engine directory', () => {
    const root = createTemporaryDirectory();
    const engineDir = path.join(root, 'Engine');
    createValidEngineDirectory(engineDir);

    expect(coerceInstalledEnginePathToEngineDirectory(engineDir)).toBe(engineDir);
  });

  it('appends Engine/ when the install root contains a nested Engine directory', () => {
    const root = createTemporaryDirectory();
    const engineDir = path.join(root, 'Engine');
    createValidEngineDirectory(engineDir);

    expect(coerceInstalledEnginePathToEngineDirectory(root)).toBe(engineDir);
  });

  it('returns undefined for an invalid path', () => {
    expect(coerceInstalledEnginePathToEngineDirectory('/nonexistent/path')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(coerceInstalledEnginePathToEngineDirectory('')).toBeUndefined();
  });
});

describe('EngineAssociationResolver', () => {
  it('resolves engine directory from a mocked Windows registry', () => {
    const root = createTemporaryDirectory();
    const engineDir = path.join(root, 'Engine');
    createValidEngineDirectory(engineDir);

    const resolver = new EngineAssociationResolver({
      platform: 'win32',
      queryWindowsRegistryValue: (_keyPath, _valueName) => root,
    });

    expect(resolver.resolveEngineDirectory('UEI5.7.3')).toBe(engineDir);
  });

  it('resolves engine directory from a mocked Install.ini on Linux', () => {
    const root = createTemporaryDirectory();
    const engineDir = path.join(root, 'Engine');
    createValidEngineDirectory(engineDir);

    const iniContent = `[Installations]\nUEI5.7.3=${root}\n`;

    const resolver = new EngineAssociationResolver({
      platform: 'linux',
      homeDir: root,
      readFile: () => iniContent,
    });

    expect(resolver.resolveEngineDirectory('UEI5.7.3')).toBe(engineDir);
  });

  it('returns undefined for an empty association string', () => {
    const resolver = new EngineAssociationResolver({ platform: 'win32' });
    expect(resolver.resolveEngineDirectory('')).toBeUndefined();
  });

  it('returns undefined when registry returns no match', () => {
    const resolver = new EngineAssociationResolver({
      platform: 'win32',
      queryWindowsRegistryValue: () => undefined,
    });

    expect(resolver.resolveEngineDirectory('SomeEngine')).toBeUndefined();
  });
});
