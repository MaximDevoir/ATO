export type UAPKGCommandName = 'init' | 'add' | 'install' | 'update' | 'project-get-name' | 'config';
export type UAPKGConfigAction = 'get' | 'list' | 'set' | 'delete' | 'edit';

export interface UAPKGCommandLine {
  command: UAPKGCommandName;
  cwd: string;
  args: string[];
  type?: 'project' | 'plugin';
  name?: string;
  force: boolean;
  pin: boolean;
  harnessed: boolean;
  configAction?: UAPKGConfigAction;
  json: boolean;
  global: boolean;
  local: boolean;
  showOrigin: boolean;
  trace: boolean;
}
