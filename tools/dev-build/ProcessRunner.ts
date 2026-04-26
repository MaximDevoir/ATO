import { spawnSync } from 'node:child_process';

interface RunOptions {
  ignoreFailure?: boolean;
  env?: NodeJS.ProcessEnv;
}

export class ProcessRunner {
  run(command: string, args: string[], cwd: string, options: RunOptions = {}) {
    const result = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...options.env,
      },
    });

    this.throwIfFailed(command, args, result.error, result.status, options.ignoreFailure);
  }

  runAndCapture(command: string, args: string[], cwd: string, options: RunOptions = {}) {
    const result = spawnSync(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...options.env,
      },
    });

    this.throwIfFailed(command, args, result.error, result.status, options.ignoreFailure);

    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      status: result.status ?? 0,
    };
  }

  private throwIfFailed(
    command: string,
    args: string[],
    error: Error | undefined,
    status: number | null,
    ignoreFailure: boolean | undefined,
  ) {
    if (error) {
      throw error;
    }

    if ((status ?? 1) !== 0 && ignoreFailure !== true) {
      throw new Error(`[dev-build] Command failed: ${command} ${args.join(' ')}`);
    }
  }
}
