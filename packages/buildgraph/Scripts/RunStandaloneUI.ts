#!/usr/bin/env node
import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

type ParsedArgs = {
  skipPrepare: boolean;
  ueRoot?: string;
  project?: string;
  passthrough: string[];
};

function fail(message: string): never {
  console.error(`[standalone-ui] ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const passthrough: string[] = [];
  let skipPrepare = false;
  let ueRoot: string | undefined;
  let project: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index] ?? '';
    if (current === '--skipPrepare') {
      skipPrepare = true;
      continue;
    }

    if (current === '--UERoot') {
      ueRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (current.startsWith('--UERoot=')) {
      ueRoot = current.slice('--UERoot='.length);
      continue;
    }

    if (current === '--Project') {
      project = argv[index + 1];
      index += 1;
      continue;
    }

    if (current.startsWith('--Project=')) {
      project = current.slice('--Project='.length);
      continue;
    }

    passthrough.push(current);
  }

  return { skipPrepare, ueRoot, project, passthrough };
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
    console.warn(`[standalone-ui] Multiple .uproject files found; using ${projectFiles[0]}`);
  }

  return path.join(projectRoot, projectFiles[0] ?? '');
}

function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: false,
    stdio: 'inherit',
  });

  return result.status ?? 1;
}

const parsed = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
const ueRoot = path.resolve(parsed.ueRoot ?? process.env.ENGINE_DIR ?? fail('ENGINE_DIR is not set'));
const projectFile = resolveProjectFile(projectRoot, parsed.project);
const env = {
  ...process.env,
  FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
};

if (!parsed.skipPrepare) {
  console.log('[standalone-ui] Preparing cooked/built standalone runtime...');
  const prepareExitCode = runCommand(
    process.execPath,
    [
      '--import',
      'tsx',
      path.join(projectRoot, 'BuildGraph', 'RunUAT.ts'),
      'BuildGraph',
      `-Script=${path.join(projectRoot, 'BuildGraph', 'ATCTests.generated.xml')}`,
      '-Target=StandaloneUIPrepare',
    ],
    projectRoot,
    env,
  );

  if (prepareExitCode !== 0) {
    process.exit(prepareExitCode);
  }
}

console.log('[standalone-ui] Launching interactive standalone UI runner...');
const runExitCode = runCommand(
  process.execPath,
  [
    '--import',
    'tsx',
    path.join(projectRoot, 'BuildGraph', 'Scripts', 'RunStandaloneTest.ts'),
    '--UERoot',
    ueRoot,
    '--Project',
    projectFile,
    '--reporter=default',
    ...parsed.passthrough,
  ],
  projectRoot,
  env,
);

process.exit(runExitCode);
