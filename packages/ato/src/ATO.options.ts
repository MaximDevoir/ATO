import type { UnrealLagProfileName } from '@UMaestro/UnrealLag';

// See https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-command-line-arguments-reference for list of some arguments.
export type ProcessArgs = string[];

export type ATCOrchestratorLaunchMode = 'DedicatedServer' | 'ListenServer' | 'Standalone' | 'PIE';

export interface UnrealLagProxyOptions {
  bindAddress?: string;
  bindPort?: number;
  serverProfile?: UnrealLagProfileName;
  clientProfile?: UnrealLagProfileName;
}

export interface ProcessLaunchOptions {
  // optional absolute path; when omitted the orchestrator will probe common locations
  exe?: string;
  // project uproject path
  project: string;
  // A list of additional arguments to append to the process launch. You can overwrite previously defined arguments by pushing new arguments onto
  // extraArgs.
  extraArgs: ProcessArgs;
  // A list of arguments to remove from extraArgs. Alternatively, to overwrite an argument, push the new argument onto extraArgs. Only the
  // last-defined argument is used in extraArgs.
  excludeArgs: ProcessArgs;
  // maximum lifetime (seconds) for the process before test failure
  maxLifetime?: number;
  // optional TestExit command
  testExit?: string;
  // array of tests to run. Appended at the end of supplied ExecCmds
  execTests: string[];
  // array of commands pass into ExecCmds option.
  execCmds: string[];
  // Whether to automatically inject ATC orchestrator/bootstrap and shutdown tests into the test queue.
  // Defaults to true in RuntimePresets and can be disabled per process when not running ATC.
  automaticallyApplyBootstrapTestsCmds?: boolean;
}

export interface ServerOptions extends ProcessLaunchOptions {
  port?: number; // UDP port server will bind (optional)
  timeoutSeconds?: number; // how long to wait for server UDP bind
  startupMap?: string; // optional startup map/url for host-style launches such as listen server
}

export interface ClientOptions extends ProcessLaunchOptions {
  host?: string; // host to connect to
}

export interface E2ERuntimeOptions {
  // Number of external client processes to launch for DedicatedServer / ListenServer runs.
  // Standalone and PIE ignore this and run with zero external ATC clients.
  clientCount?: number;
  port?: number;
  timeoutSeconds?: number;
  serverExe?: string;
  clientExe?: string;
  atcOrchestratorMode?: ATCOrchestratorLaunchMode;
  dryRun?: boolean;
}

export interface E2ECommandLineContext {
  ueRoot: string;
  projectPath: string;
  projectRoot: string;
}

export interface E2ECommandLineOptions extends E2ERuntimeOptions {
  argv?: string[];
}

export const RuntimePresets = {
  Server(projectPath: string, serverExe?: string): ServerOptions {
    return {
      exe: serverExe,
      project: projectPath,
      extraArgs: ['-log', '-stdout', '-FullStdOutLogOutputs', '-unattended', '-nullrhi'],
      excludeArgs: [],
      port: 7777,
      timeoutSeconds: 60,
      maxLifetime: 600,
      testExit: 'Automation Test Queue Empty',
      execTests: [],
      execCmds: [],
      automaticallyApplyBootstrapTestsCmds: true,
    };
  },
  Client(projectPath: string, host = '127.0.0.1', clientExe?: string): ClientOptions {
    return {
      exe: clientExe,
      project: projectPath,
      host,
      extraArgs: ['-game', '-stdout', '-FullStdOutLogOutputs', '-unattended', '-nosound', '-nullrhi', '-NoSplash'],
      excludeArgs: [],
      maxLifetime: 300,
      execTests: [],
      execCmds: [],
      testExit: 'Automation Test Queue Empty',
      automaticallyApplyBootstrapTestsCmds: true,
    };
  },
};
