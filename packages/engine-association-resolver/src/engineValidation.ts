import * as path from 'node:path';
import { checkExistsSync } from './fileHelpers';

export function isValidEngineDirectory(engineDir: string) {
  if (!engineDir) {
    return false;
  }

  const resolvedEngineDir = path.resolve(engineDir);
  return (
    checkExistsSync(path.join(resolvedEngineDir, 'Build', 'BatchFiles', 'RunUAT.bat')) ||
    checkExistsSync(path.join(resolvedEngineDir, 'Build', 'BatchFiles', 'RunUAT.sh')) ||
    checkExistsSync(path.join(resolvedEngineDir, 'Binaries', 'DotNET', 'AutomationTool', 'AutomationTool.dll'))
  );
}

export function coerceInstalledEnginePathToEngineDirectory(engineInstallPath: string) {
  if (!engineInstallPath) {
    return undefined;
  }

  const resolvedPath = path.resolve(engineInstallPath.trim());
  if (isValidEngineDirectory(resolvedPath)) {
    return resolvedPath;
  }

  const nestedEngineDirectory = path.join(resolvedPath, 'Engine');
  if (isValidEngineDirectory(nestedEngineDirectory)) {
    return nestedEngineDirectory;
  }

  return undefined;
}
