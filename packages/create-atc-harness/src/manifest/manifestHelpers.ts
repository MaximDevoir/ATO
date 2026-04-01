import * as path from 'node:path';
import type { FileSystem } from '../services/FileSystem';
import { parseAndValidateATCManifest } from './ATCManifest';

export function resolveManifestPath(fileSystem: FileSystem, manifestString: string) {
  const resolvedInput = path.resolve(manifestString);
  if (!fileSystem.exists(resolvedInput)) {
    throw new Error(`[create-atc-harness] manifestString does not exist: ${manifestString}`);
  }

  if (fileSystem.isDirectory(resolvedInput)) {
    const manifestPath = path.join(resolvedInput, 'atc.json');
    if (!fileSystem.exists(manifestPath)) {
      throw new Error(`[create-atc-harness] Folder does not contain atc.json: ${resolvedInput}`);
    }
    return manifestPath;
  }

  if (path.basename(resolvedInput).toLowerCase() !== 'atc.json') {
    throw new Error(`[create-atc-harness] manifestString file must be atc.json: ${resolvedInput}`);
  }

  return resolvedInput;
}

export function readManifestAtPath(fileSystem: FileSystem, manifestPath: string) {
  const rawManifest = fileSystem.readText(manifestPath);
  const manifest = parseAndValidateATCManifest(rawManifest, manifestPath);
  return {
    manifestPath,
    manifestDirectory: path.dirname(manifestPath),
    manifest,
  };
}

export function resolvePluginRootFromManifestFolder(fileSystem: FileSystem, manifestDirectory: string) {
  const candidatePluginRoots: string[] = [];
  collectPluginRoots(fileSystem, manifestDirectory, candidatePluginRoots);

  if (candidatePluginRoots.length === 0) {
    throw new Error(
      `[create-atc-harness] Could not find a .uplugin file under manifest directory: ${manifestDirectory}`,
    );
  }

  if (candidatePluginRoots.length > 1) {
    throw new Error(
      `[create-atc-harness] Found multiple plugins under manifest directory; expected exactly one: ${manifestDirectory}`,
    );
  }

  return candidatePluginRoots[0];
}

function collectPluginRoots(fileSystem: FileSystem, directoryPath: string, output: string[]) {
  for (const entryPath of fileSystem.listEntries(directoryPath)) {
    if (fileSystem.isDirectory(entryPath)) {
      collectPluginRoots(fileSystem, entryPath, output);
      continue;
    }

    if (entryPath.toLowerCase().endsWith('.uplugin')) {
      output.push(path.dirname(entryPath));
    }
  }
}
