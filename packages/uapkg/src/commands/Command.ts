export interface Command {
  execute(): Promise<number>;
}
