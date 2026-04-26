import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { coerceInstalledEnginePathToEngineDirectory } from './engineValidation.js';

const WINDOWS_ENGINE_BUILDS_REGISTRY_KEY = 'HKCU\\Software\\Epic Games\\Unreal Engine\\Builds';

export interface EngineAssociationResolverDependencies {
  platform?: NodeJS.Platform;
  homeDir?: string;
  queryWindowsRegistryValue?: (keyPath: string, valueName: string) => string | undefined;
  readFile?: (filePath: string) => string | undefined;
}

export class EngineAssociationResolver {
  private readonly platform: NodeJS.Platform;
  private readonly homeDir: string;
  private readonly queryWindowsRegistryValue: (keyPath: string, valueName: string) => string | undefined;
  private readonly readFile: (filePath: string) => string | undefined;

  constructor(dependencies: EngineAssociationResolverDependencies = {}) {
    this.platform = dependencies.platform ?? process.platform;
    this.homeDir = dependencies.homeDir ?? os.homedir();
    this.queryWindowsRegistryValue = dependencies.queryWindowsRegistryValue ?? defaultQueryWindowsRegistryValue;
    this.readFile = dependencies.readFile ?? defaultReadFile;
  }

  resolveEngineDirectory(engineAssociation: string) {
    const normalizedAssociation = engineAssociation.trim();
    if (!normalizedAssociation) {
      return undefined;
    }

    switch (this.platform) {
      case 'win32':
        return this.resolveFromWindowsRegistry(normalizedAssociation);
      case 'linux':
        return this.resolveFromInstallIni(
          path.join(this.homeDir, '.config', 'Epic', 'UnrealEngine', 'Install.ini'),
          normalizedAssociation,
        );
      case 'darwin':
        return this.resolveFromInstallIni(
          path.join(this.homeDir, 'Library', 'Application Support', 'Epic', 'UnrealEngine', 'Install.ini'),
          normalizedAssociation,
        );
      default:
        return undefined;
    }
  }

  private resolveFromWindowsRegistry(engineAssociation: string) {
    const registryValue = this.queryWindowsRegistryValue(WINDOWS_ENGINE_BUILDS_REGISTRY_KEY, engineAssociation);
    return registryValue ? coerceInstalledEnginePathToEngineDirectory(registryValue) : undefined;
  }

  private resolveFromInstallIni(installIniPath: string, engineAssociation: string) {
    const fileContent = this.readFile(installIniPath);
    if (!fileContent) {
      return undefined;
    }

    const installations = parseInstallationsFromIni(fileContent);
    const installationPath = installations.get(engineAssociation);
    return installationPath ? coerceInstalledEnginePathToEngineDirectory(installationPath) : undefined;
  }
}

function defaultReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

function defaultQueryWindowsRegistryValue(keyPath: string, valueName: string) {
  try {
    const queryResult = spawnSync('reg', ['query', keyPath, '/v', valueName], {
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (queryResult.status !== 0) {
      return undefined;
    }

    const output = `${queryResult.stdout ?? ''}\n${queryResult.stderr ?? ''}`;
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes(valueName) || !line.includes('REG_')) {
        continue;
      }

      const parts = line
        .trim()
        .split(/\s{2,}/)
        .filter(Boolean);
      if (parts.length >= 3 && parts[0] === valueName) {
        return parts.slice(2).join(' ');
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function parseInstallationsFromIni(content: string) {
  const installations = new Map<string, string>();
  let insideInstallationsSection = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      insideInstallationsSection = line.slice(1, -1).trim().toLowerCase() === 'installations';
      continue;
    }

    if (!insideInstallationsSection) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    installations.set(key, value);
  }

  return installations;
}
