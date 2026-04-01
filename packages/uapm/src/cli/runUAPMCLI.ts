import { UAPMApplication } from '../app/UAPMApplication';
import { parseUAPMCommandLine } from './parseCommandLine';

export async function runUAPMCLI(rawArgv = process.argv) {
  const commandLine = await parseUAPMCommandLine(rawArgv);
  return await new UAPMApplication().run(commandLine);
}
