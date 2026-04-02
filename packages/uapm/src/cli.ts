import { runUAPMCLI } from './cli/runUAPMCLI';

runUAPMCLI(process.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(`[uapm] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
