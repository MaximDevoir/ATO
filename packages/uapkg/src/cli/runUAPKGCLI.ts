import { UAPKGApplication } from '../app/UAPKGApplication.js';
import { parseUAPKGCommandLine } from './parseCommandLine.js';

export async function runUAPKGCLI(rawArgv = process.argv) {
  const commandLine = await parseUAPKGCommandLine(rawArgv);
  return await new UAPKGApplication().run(commandLine);
}
