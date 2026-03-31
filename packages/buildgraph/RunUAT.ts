#!/usr/bin/env node

import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

function fail(msg: string): never {
  console.error(`[run-uat] ${msg}`);
  process.exit(1);
}

const engineDir = process.env.ENGINE_DIR;
if (!engineDir) {
  fail('ENGINE_DIR is not set (check your .env file)');
}

const resolvedEngineDir = path.resolve(engineDir);
const userArgs = process.argv.slice(2);

let cmd: string;
let args: string[];

if (os.platform() === 'win32') {
  cmd = 'dotnet';

  const dllPath = path.join(resolvedEngineDir, 'Binaries', 'DotNET', 'AutomationTool', 'AutomationTool.dll');

  args = [dllPath, ...userArgs];
} else {
  cmd = path.join(resolvedEngineDir, 'Build', 'BatchFiles', 'RunUAT.sh');

  args = userArgs;
}

console.log(`[run-uat] cmd: ${cmd}`);
console.log(`[run-uat] args: ${args.join(' ')}`);

const result = spawnSync(cmd, args, {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
