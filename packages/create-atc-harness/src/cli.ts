#!/usr/bin/env node
import { runCreateATCHarnessCLI } from './cli/runCreateATCHarness';

runCreateATCHarnessCLI(process.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(`[create-atc-harness] Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
