export type UAPMCommandName = 'init' | 'add' | 'install';

export interface UAPMCommandLine {
  command: UAPMCommandName;
  cwd: string;
  args: string[];
  type?: 'project' | 'plugin' | 'harness';
  name?: string;
}
