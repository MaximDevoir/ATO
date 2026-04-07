import type { WorkspacePackage } from './contracts';
import { ProcessRunner } from './ProcessRunner';

export class BuildService {
  constructor(
    private readonly runner: ProcessRunner,
    private readonly workspaceRoot: string,
  ) {}

  buildPackage(workspacePackage: WorkspacePackage) {
    this.runner.run('pnpm', ['--filter', workspacePackage.id, 'run', 'build'], this.workspaceRoot);
  }

  buildAll(projectNames: string[]) {
    this.runner.run('pnpm', ['nx', 'run-many', '-t', 'build', `--projects=${projectNames.join(',')}`], this.workspaceRoot);
  }
}