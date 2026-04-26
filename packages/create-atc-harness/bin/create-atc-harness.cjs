#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cliEntry = path.resolve(__dirname, '../dist/cli.js');
const args = ['--experimental-specifier-resolution=node', cliEntry, ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
