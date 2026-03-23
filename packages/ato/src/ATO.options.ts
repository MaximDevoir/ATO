import type { UnrealLagProfileName } from '@maximdevoir/unreal-lag';

// See https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-command-line-arguments-reference for list of some arguments.
export type ProcessArgs = string[];

export type ATOReporterMode = 'default' | 'basic';

export enum CoordinatorMode {
  DedicatedServer = 'DedicatedServer',
  ListenServer = 'ListenServer',
  Standalone = 'Standalone',
  PIE = 'PIE',
}

export type ATCLaunchMode = CoordinatorMode;

export interface UnrealLagProxyOptions {
  bindAddress?: string;
  bindPort?: number;
  serverProfile?: UnrealLagProfileName;
  clientProfile?: UnrealLagProfileName;
}

export interface ATIEndpointOptions {
  host: string;
  port: number;
  connectTimeoutSeconds?: number;
}

export interface ATINDJSONConsumerOptions {
  directory?: string;
  fileName?: string;
  maxFileSizeBytes?: number;
}

export interface ATIServiceOptions {
  label?: string;
  host?: string;
  port?: number;
  connectTimeoutSeconds?: number;
  validateSchema?: boolean;
  maxEventSizeBytes?: number;
  ndjson?: false | ATINDJSONConsumerOptions;
  terminal?: boolean;
}

export interface ATIRuntimeOptions {
  enabled?: boolean;
  services?: ATIServiceOptions[];
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
  // Whether to automatically inject ATC coordinator/bootstrap and shutdown tests into the test queue.
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
  // Maximum number of external client processes available to launch for DedicatedServer / ListenServer runs.
  // When omitted, ATO will spawn as many external clients as the native coordinator requests.
  // Standalone and PIE ignore this and run with zero external ATC clients.
  clientCount?: number;
  port?: number;
  timeoutSeconds?: number;
  serverExe?: string;
  clientExe?: string;
  dryRun?: boolean;
  codecov?: boolean;
  updateSnapshots?: boolean;
  reporter?: ATOReporterMode;
}

export interface E2ECommandLineContext {
  ueRoot: string;
  projectPath: string;
  projectRoot: string;
  verboseDebug: boolean;
}

export interface E2ECommandLineOptions extends E2ERuntimeOptions {
  argv?: string[];
}

export const RuntimePresets = {
  Server(projectPath: string, serverExe?: string): ServerOptions {
    const serverConfig = {
      exe: serverExe,
      project: projectPath,
      extraArgs: [
        '-server',
        '-log',
        '-stdout',
        '-FullStdOutLogOutputs',
        '-unattended',
        '-nullrhi',
        '-NoSplash',
        '-Verbose',
      ],
      excludeArgs: [],
      port: 7777,
      timeoutSeconds: 60,
      maxLifetime: 600,
      testExit: 'Automation Test Queue Empty',
      execTests: [],
      execCmds: [],
      automaticallyApplyBootstrapTestsCmds: true,
    };
    // LiveCoding will report exit code 1 if the process life is short enough
    serverConfig.extraArgs.push('-LiveCoding=0');
    return serverConfig;
  },
  Client(projectPath: string, host = '127.0.0.1', clientExe?: string): ClientOptions {
    const clientConfig = {
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
    // LiveCoding will report exit code 1 if the process life is short enough
    clientConfig.extraArgs.push('-LiveCoding=0');
    return clientConfig;
  },
};
