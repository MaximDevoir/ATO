import { runUAPKGCLI } from './cli/runUAPKGCLI';

runUAPKGCLI(process.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(`[uapkg] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
