import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DevBuildOrchestrator } from './DevBuildOrchestrator';
import type { DevBuildMode } from './types';

function resolveWorkspaceRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..', '..');
}

function normalizeMode(rawMode: string | undefined): DevBuildMode {
  if (!rawMode || rawMode === 'build') {
    return 'build';
  }

  if (rawMode === 'link') {
    return 'link';
  }

  if (rawMode === 'watch') {
    return 'watch';
  }

  if (rawMode === 'unlink') {
    return 'unlink';
  }

  if (rawMode === 'status') {
    return 'status';
  }

  throw new Error(`[dev-build] Unsupported mode: ${rawMode}`);
}

function parseOptions(args: string[]) {
  return {
    force: args.includes('--force'),
  };
}

const mode = normalizeMode(process.argv[2]);
const options = parseOptions(process.argv.slice(3));
const orchestrator = new DevBuildOrchestrator(resolveWorkspaceRoot());

if (mode === 'build') {
  orchestrator.buildAll();
} else if (mode === 'link') {
  orchestrator.link(options);
} else if (mode === 'watch') {
  orchestrator.watch();
} else if (mode === 'unlink') {
  orchestrator.unlink(options);
} else {
  orchestrator.status();
}
