export type UAPKGCommandName = 'init' | 'add' | 'install' | 'update' | 'project-get-name' | 'config';
export type UAPKGConfigAction = 'get' | 'list' | 'set' | 'delete' | 'edit';
export type UAPKGConfigScope = 'global' | 'local';
export type UAPKGOutputFormat = 'text' | 'json';

interface BaseCommandLine {
  command: UAPKGCommandName;
  cwd: string;
}

export interface InitCommandLine extends BaseCommandLine {
  command: 'init';
  type?: 'project' | 'plugin';
  name?: string;
}

export interface AddCommandLine extends BaseCommandLine {
  command: 'add';
  source: string;
  force: boolean;
  pin: boolean;
  harnessed: boolean;
}

export interface InstallCommandLine extends BaseCommandLine {
  command: 'install';
  force: boolean;
}

export interface UpdateCommandLine extends BaseCommandLine {
  command: 'update';
  force: boolean;
}

export interface ProjectGetNameCommandLine extends BaseCommandLine {
  command: 'project-get-name';
}

export interface ConfigCommandLine extends BaseCommandLine {
  command: 'config';
  action: UAPKGConfigAction;
  path?: string;
  value?: string;
  scope?: UAPKGConfigScope;
  output: UAPKGOutputFormat;
  showOrigin: boolean;
  trace: boolean;
}

export type UAPKGCommandLine =
  | InitCommandLine
  | AddCommandLine
  | InstallCommandLine
  | UpdateCommandLine
  | ProjectGetNameCommandLine
  | ConfigCommandLine;

export interface CommonCommandLineOptions {
  cwd?: string;
}

export interface AddCommandLineOptions extends CommonCommandLineOptions {
  force?: boolean;
  pin?: boolean;
  harnessed?: boolean;
}

export interface InstallOrUpdateCommandLineOptions extends CommonCommandLineOptions {
  force?: boolean;
}

export interface ConfigCommonOptions extends CommonCommandLineOptions {
  scope?: UAPKGConfigScope;
  output?: UAPKGOutputFormat;
}

export interface ConfigGetOptions extends ConfigCommonOptions {
  showOrigin?: boolean;
  trace?: boolean;
}

export class UAPKGCommandLineFactory {
  constructor(private readonly cwdProvider: () => string = () => process.cwd()) {}

  createInit(options: { type?: 'project' | 'plugin'; name?: string } & CommonCommandLineOptions = {}): InitCommandLine {
    return {
      command: 'init',
      cwd: this.resolveCwd(options.cwd),
      type: options.type,
      name: options.name,
    };
  }

  createAdd(source: string, options: AddCommandLineOptions = {}): AddCommandLine {
    return {
      command: 'add',
      cwd: this.resolveCwd(options.cwd),
      source,
      force: options.force === true,
      pin: options.pin === true,
      harnessed: options.harnessed === true,
    };
  }

  createInstall(options: InstallOrUpdateCommandLineOptions = {}): InstallCommandLine {
    return {
      command: 'install',
      cwd: this.resolveCwd(options.cwd),
      force: options.force === true,
    };
  }

  createUpdate(options: InstallOrUpdateCommandLineOptions = {}): UpdateCommandLine {
    return {
      command: 'update',
      cwd: this.resolveCwd(options.cwd),
      force: options.force === true,
    };
  }

  createProjectGetName(options: CommonCommandLineOptions = {}): ProjectGetNameCommandLine {
    return {
      command: 'project-get-name',
      cwd: this.resolveCwd(options.cwd),
    };
  }

  createConfigGet(path: string, options: ConfigGetOptions = {}): ConfigCommandLine {
    return {
      command: 'config',
      action: 'get',
      cwd: this.resolveCwd(options.cwd),
      path,
      scope: options.scope,
      output: options.output ?? 'text',
      showOrigin: options.showOrigin === true,
      trace: options.trace === true,
    };
  }

  createConfigList(options: ConfigCommonOptions = {}): ConfigCommandLine {
    return {
      command: 'config',
      action: 'list',
      cwd: this.resolveCwd(options.cwd),
      scope: options.scope,
      output: options.output ?? 'text',
      showOrigin: false,
      trace: false,
    };
  }

  createConfigSet(path: string, value: string, options: ConfigCommonOptions = {}): ConfigCommandLine {
    return {
      command: 'config',
      action: 'set',
      cwd: this.resolveCwd(options.cwd),
      path,
      value,
      scope: options.scope,
      output: options.output ?? 'text',
      showOrigin: false,
      trace: false,
    };
  }

  createConfigDelete(path: string, options: ConfigCommonOptions = {}): ConfigCommandLine {
    return {
      command: 'config',
      action: 'delete',
      cwd: this.resolveCwd(options.cwd),
      path,
      scope: options.scope,
      output: options.output ?? 'text',
      showOrigin: false,
      trace: false,
    };
  }

  createConfigEdit(options: ConfigCommonOptions = {}): ConfigCommandLine {
    return {
      command: 'config',
      action: 'edit',
      cwd: this.resolveCwd(options.cwd),
      scope: options.scope,
      output: options.output ?? 'text',
      showOrigin: false,
      trace: false,
    };
  }

  private resolveCwd(cwd?: string) {
    return cwd ?? this.cwdProvider();
  }
}

export function createUAPKGCommandLineFactory(cwdProvider?: () => string) {
  return new UAPKGCommandLineFactory(cwdProvider);
}
