export type UAPMCommandName = 'init' | 'add' | 'install' | 'update' | 'project-get-name';

export interface UAPMCommandLine {
  command: UAPMCommandName;
  cwd: string;
  args: string[];
  type?: 'project' | 'plugin';
  name?: string;
  force: boolean;
  pin: boolean;
  harnessed: boolean;
}
