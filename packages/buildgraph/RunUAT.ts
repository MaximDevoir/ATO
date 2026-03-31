#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { resolveAutomationContext } from '@maximdevoir/ato';

const resolvedContext = resolveAutomationContext({
  rawArgv: process.argv,
  cwd: process.cwd(),
  env: process.env,
});
const resolvedEngineDir = path.resolve(resolvedContext.ueRoot);
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
  cwd: resolvedContext.projectRoot,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
