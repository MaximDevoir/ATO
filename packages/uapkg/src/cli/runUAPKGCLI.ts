import { UAPKGApplication } from '../app/UAPKGApplication';
import { parseUAPKGCommandLine } from './parseCommandLine';

export async function runUAPKGCLI(rawArgv = process.argv) {
  const commandLine = await parseUAPKGCommandLine(rawArgv);
  return await new UAPKGApplication().run(commandLine);
}
