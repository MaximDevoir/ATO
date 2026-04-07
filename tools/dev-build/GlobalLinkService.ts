import fs from 'node:fs';
import path from 'node:path';
import type { WorkspacePackage } from './contracts';
import { ProcessRunner } from './ProcessRunner';

export class GlobalLinkService {
  constructor(private readonly runner: ProcessRunner) {}

  relinkPackage(workspacePackage: WorkspacePackage, workspaceRoot: string) {
    const pnpmHome = path.join(workspaceRoot, '.pnpm-global');
    fs.mkdirSync(pnpmHome, { recursive: true });

    const env = {
      PNPM_HOME: pnpmHome,
      PATH: `${pnpmHome}${path.delimiter}${process.env.PATH ?? ''}`,
    };

    this.runner.run('pnpm', ['unlink', '--global', workspacePackage.id], workspaceRoot, { ignoreFailure: true, env });
    this.runner.run('pnpm', ['link', '--global'], workspacePackage.directory, { env });
  }
}
