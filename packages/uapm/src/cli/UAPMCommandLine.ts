export type UAPMCommandName = 'init' | 'add' | 'install' | 'update';

export interface UAPMCommandLine {
  command: UAPMCommandName;
  cwd: string;
  args: string[];
  type?: 'project' | 'plugin' | 'harness';
  name?: string;
  force: boolean;
}
