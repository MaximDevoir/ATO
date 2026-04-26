#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), '..');
const dryRun = process.argv.includes('--dry-run');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`[clean-all] Command failed: ${command} ${args.join(' ')}`);
  }
}

function runOptional(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error || (result.status ?? 1) !== 0) {
    console.warn(`[clean-all] Optional command failed: ${command} ${args.join(' ')}`);
  }
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  if (dryRun) {
    console.log(`[clean-all] Would remove: ${targetPath}`);
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`[clean-all] Removed: ${targetPath}`);
}

function listPackageDirectories() {
  const packagesDir = path.join(workspaceRoot, 'packages');
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name));
}

function main() {
  if (dryRun) {
    console.log('[clean-all] Running in dry-run mode. No files will be deleted.');
  }

  run('pnpm', ['run', 'build:clean']);

  const packageDirs = listPackageDirectories();
  const cleanupRoots = [workspaceRoot, ...packageDirs];

  for (const dir of cleanupRoots) {
    removeIfExists(path.join(dir, 'node_modules'));
    removeIfExists(path.join(dir, '.pnpm-store'));
  }

  runOptional('pnpm', ['store', 'prune']);
  runOptional('pnpm', ['nx', 'reset']);
}

main();
