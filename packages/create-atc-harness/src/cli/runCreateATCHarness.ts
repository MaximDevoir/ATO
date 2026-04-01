import { CreateATCHarness } from '../app/CreateATCHarness';
import { HarnessResultState } from '../domain/HarnessCreationResult';
import { parseCreateATCHarnessCommandLine } from './parseCommandLine';

export async function runCreateATCHarnessCLI(rawArgv = process.argv) {
  const commandLine = await parseCreateATCHarnessCommandLine(rawArgv);
  const app = new CreateATCHarness(commandLine);
  const result = await app.run();

  for (const line of result.logs) {
    console.log(line);
  }
  for (const warning of result.warnings) {
    console.warn(warning);
  }
  for (const error of result.errors) {
    console.error(error);
  }

  return result.result === HarnessResultState.Success ? 0 : 1;
}
