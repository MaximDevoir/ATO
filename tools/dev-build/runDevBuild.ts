import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DevBuildOrchestrator } from './DevBuildOrchestrator';

function resolveWorkspaceRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..', '..');
}

function normalizeMode(rawMode: string | undefined) {
  if (!rawMode || rawMode === 'build') {
    return 'build' as const;
  }

  if (rawMode === 'devOnce') {
    return 'devOnce' as const;
  }

  if (rawMode === 'devWatch') {
    return 'devWatch' as const;
  }

  throw new Error(`[dev-build] Unsupported mode: ${rawMode}`);
}

const mode = normalizeMode(process.argv[2]);
const orchestrator = new DevBuildOrchestrator(resolveWorkspaceRoot());

if (mode === 'build') {
  orchestrator.buildAll();
} else if (mode === 'devOnce') {
  orchestrator.buildAndRelinkAllOnce();
} else {
  orchestrator.watchAndRebuildAndRelink();
}
