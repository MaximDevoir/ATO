import { spawnSync } from 'node:child_process';

export class ProcessRunner {
  run(
    command: string,
    args: string[],
    cwd: string,
    options: { ignoreFailure?: boolean; env?: NodeJS.ProcessEnv } = {},
  ) {
    const result = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...options.env,
      },
    });

    if (result.error) {
      throw result.error;
    }

    if ((result.status ?? 1) !== 0 && options.ignoreFailure !== true) {
      throw new Error(`[dev-build] Command failed: ${command} ${args.join(' ')}`);
    }
  }
}
