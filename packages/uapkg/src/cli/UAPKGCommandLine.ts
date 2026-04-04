export type UAPKGCommandName = 'init' | 'add' | 'install' | 'update' | 'project-get-name';

export interface UAPKGCommandLine {
  command: UAPKGCommandName;
  cwd: string;
  args: string[];
  type?: 'project' | 'plugin';
  name?: string;
  force: boolean;
  pin: boolean;
  harnessed: boolean;
}
