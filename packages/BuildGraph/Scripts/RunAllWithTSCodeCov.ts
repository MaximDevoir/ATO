import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scripts = ['RunStandaloneTest.ts', 'RunListenServerTest.ts', 'RunDedicated.tests.ts', 'RunPIETest.ts'].map(
  (script) => path.resolve(__dirname, script),
);

function fail(message: string): never {
  console.error(`[CodeCov] ${message}`);
  process.exit(1);
}

function resolveProjectFile(projectRoot: string, overrideProject?: string) {
  if (overrideProject) {
    return path.resolve(overrideProject);
  }

  const projectFiles = readdirSync(projectRoot).filter((entry) => entry.endsWith('.uproject'));
  if (projectFiles.length === 0) {
    fail(`No .uproject file found in ${projectRoot}`);
  }

  if (projectFiles.length > 1) {
    console.warn(`[CodeCov] Multiple .uproject files found; using ${projectFiles[0]}`);
  }

  return path.join(projectRoot, projectFiles[0] ?? '');
}

const projectRoot = process.cwd();
const ueRoot = path.resolve(process.env.ENGINE_DIR ?? fail('ENGINE_DIR is not set'));
const projectFile = resolveProjectFile(projectRoot);

for (const script of scripts) {
  console.log(`\n=== Running ${script} ===`);

  const result = spawnSync('node', ['--import', 'tsx', script, '--UERoot', ueRoot, '--Project', projectFile], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
