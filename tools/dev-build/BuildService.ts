import type { ProcessRunner } from './ProcessRunner';

export class BuildService {
  constructor(
    private readonly runner: ProcessRunner,
    private readonly workspaceRoot: string,
  ) {}

  buildAll() {
    this.runner.run('pnpm', ['nx', 'run-many', '-t', 'build', '--all'], this.workspaceRoot);
  }

  buildCliWithDependencies() {
    this.runner.run('pnpm', ['nx', 'run', 'uapkg:build'], this.workspaceRoot);
  }

  watchCliAndDependents() {
    this.runner.run(
      'pnpm',
      ['nx', 'watch', '--projects=uapkg', '--includeDependentProjects', '--', 'pnpm', 'run', 'build:link'],
      this.workspaceRoot,
    );
  }
}
