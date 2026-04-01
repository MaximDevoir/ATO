import * as path from 'node:path';
import { checkExistsSync } from './ATO._helpers';

export {
  coerceInstalledEnginePathToEngineDirectory,
  isValidEngineDirectory,
} from '@maximdevoir/engine-association-resolver';

export interface UnrealHostPlatformInfo {
  compilePlatform: string;
  cookPlatformStandalone: string;
  cookPlatformDedicated: string;
  binaryDirectories: string[];
  executableExtension: string;
  engineEditorRelativePaths: string[];
}

export function normalizePathSlashes(value: string) {
  return value.replace(/\\/g, '/');
}

export function resolveUnrealHostPlatform(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
): UnrealHostPlatformInfo {
  if (platform === 'win32') {
    return {
      compilePlatform: 'Win64',
      cookPlatformStandalone: 'Windows',
      cookPlatformDedicated: 'WindowsServer',
      binaryDirectories: ['Win64'],
      executableExtension: '.exe',
      engineEditorRelativePaths: [path.join('Binaries', 'Win64', 'UnrealEditor.exe')],
    };
  }

  if (platform === 'darwin') {
    return {
      compilePlatform: 'Mac',
      cookPlatformStandalone: 'Mac',
      cookPlatformDedicated: 'MacServer',
      binaryDirectories: ['Mac'],
      executableExtension: '',
      engineEditorRelativePaths: [
        path.join('Binaries', 'Mac', 'UnrealEditor.app', 'Contents', 'MacOS', 'UnrealEditor'),
        path.join('Binaries', 'Mac', 'UnrealEditor'),
      ],
    };
  }

  if (platform === 'linux' && arch === 'arm64') {
    return {
      compilePlatform: 'LinuxArm64',
      cookPlatformStandalone: 'Linux',
      cookPlatformDedicated: 'LinuxServer',
      binaryDirectories: ['LinuxArm64', 'Linux'],
      executableExtension: '',
      engineEditorRelativePaths: [
        path.join('Binaries', 'LinuxArm64', 'UnrealEditor'),
        path.join('Binaries', 'Linux', 'UnrealEditor'),
      ],
    };
  }

  return {
    compilePlatform: 'Linux',
    cookPlatformStandalone: 'Linux',
    cookPlatformDedicated: 'LinuxServer',
    binaryDirectories: ['Linux'],
    executableExtension: '',
    engineEditorRelativePaths: [path.join('Binaries', 'Linux', 'UnrealEditor')],
  };
}

export function resolveEngineEditorCandidates(engineDir: string, host = resolveUnrealHostPlatform()) {
  return host.engineEditorRelativePaths.map((relativePath) => path.join(engineDir, relativePath));
}

export function resolveProjectBinaryCandidates(
  projectRoot: string,
  executableBaseName: string,
  host = resolveUnrealHostPlatform(),
) {
  return host.binaryDirectories.map((binaryDirectory) => {
    return path.join(projectRoot, 'Binaries', binaryDirectory, `${executableBaseName}${host.executableExtension}`);
  });
}

export function resolveBuildGraphSchemaLocation(engineDir: string) {
  const schemaPath = path.join(engineDir, 'Build', 'Graph', 'Schema.xsd');
  if (!checkExistsSync(schemaPath)) {
    return 'http://www.epicgames.com/BuildGraph';
  }

  return `http://www.epicgames.com/BuildGraph ${normalizePathSlashes(schemaPath)}`;
}

export function isValidUProjectFile(projectPath: string) {
  return projectPath.toLowerCase().endsWith('.uproject') && checkExistsSync(projectPath);
}
