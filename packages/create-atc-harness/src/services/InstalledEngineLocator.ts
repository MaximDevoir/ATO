import { spawnSync } from 'node:child_process';
import os from 'node:os';
import * as path from 'node:path';
import { EngineAssociationResolver } from '@maximdevoir/engine-association-resolver';
import type { FileSystem } from './FileSystem';

const WINDOWS_ENGINE_BUILDS_REGISTRY_KEY = 'HKCU\\Software\\Epic Games\\Unreal Engine\\Builds';

export interface InstalledEngineRecord {
  association: string;
  directory: string;
}

export class InstalledEngineLocator {
  private readonly resolver = new EngineAssociationResolver();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  listInstalledEngines() {
    switch (this.platform) {
      case 'win32':
        return this.listFromWindowsRegistry();
      case 'linux':
        return this.listFromInstallIni(path.join(os.homedir(), '.config', 'Epic', 'UnrealEngine', 'Install.ini'));
      case 'darwin':
        return this.listFromInstallIni(
          path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'UnrealEngine', 'Install.ini'),
        );
      default:
        return [];
    }
  }

  private listFromWindowsRegistry() {
    const queryResult = spawnSync('reg', ['query', WINDOWS_ENGINE_BUILDS_REGISTRY_KEY], {
      encoding: 'utf-8',
      windowsHide: true,
    });

    if (queryResult.status !== 0) {
      return [];
    }

    const lines = queryResult.stdout.split(/\r?\n/);
    const engines: InstalledEngineRecord[] = [];
    for (const line of lines) {
      if (!line.includes('REG_')) {
        continue;
      }

      const parts = line
        .trim()
        .split(/\s{2,}/)
        .filter(Boolean);
      if (parts.length < 3) {
        continue;
      }

      const association = parts[0];
      const directory = this.resolver.resolveEngineDirectory(association);
      if (!directory) {
        continue;
      }
      engines.push({ association, directory });
    }

    return engines;
  }

  private listFromInstallIni(installIniPath: string) {
    if (!this.fileSystem.exists(installIniPath)) {
      return [];
    }

    const content = this.fileSystem.readText(installIniPath);
    const entries: InstalledEngineRecord[] = [];
    let inInstallationsSection = false;
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        inInstallationsSection = line.slice(1, -1).trim().toLowerCase() === 'installations';
        continue;
      }

      if (!inInstallationsSection) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 0) {
        continue;
      }

      const association = line.slice(0, separatorIndex).trim();
      const directory = line.slice(separatorIndex + 1).trim();
      if (!association || !directory) {
        continue;
      }
      entries.push({ association, directory });
    }

    return entries;
  }
}
