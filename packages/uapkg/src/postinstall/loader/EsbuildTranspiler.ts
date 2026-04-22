import fs from 'node:fs';
import {
  type Result,
  ok,
  fail,
  createPostinstallEsbuildErrorDiagnostic,
} from '@uapkg/diagnostics';
import { build, type BuildOptions } from 'esbuild';

/**
 * Transpiles a single `.ts` postinstall entry into an in-memory ESM bundle.
 *
 * Constraints:
 *   * `bundle: false` — we only lower TypeScript to JS; users are expected to
 *     import shared modules via `node_modules` which the loader's dynamic
 *     import handles natively.
 *   * No type-checking. The user's IDE / CI catches type errors; `uapkg` only
 *     needs a runnable module.
 *   * `platform: node`, `format: esm`, `target: node20`.
 *
 * On failure returns a `POSTINSTALL_ESBUILD_ERROR` diagnostic.
 */
export class EsbuildTranspiler {
  public async transpile(packageName: string, entryFile: string): Promise<Result<string>> {
    let source: string;
    try {
      source = fs.readFileSync(entryFile, 'utf-8');
    } catch (error) {
      return fail([
        createPostinstallEsbuildErrorDiagnostic(
          packageName,
          entryFile,
          error instanceof Error ? error.message : String(error),
        ),
      ]);
    }

    const options: BuildOptions = {
      stdin: {
        contents: source,
        loader: 'ts',
        sourcefile: entryFile,
        resolveDir: entryFile.replace(/[\\/][^\\/]+$/, ''),
      },
      bundle: false,
      write: false,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      sourcemap: false,
      logLevel: 'silent',
    };

    try {
      const result = await build(options);
      const file = result.outputFiles?.[0];
      if (!file) {
        return fail([
          createPostinstallEsbuildErrorDiagnostic(packageName, entryFile, 'esbuild produced no output'),
        ]);
      }
      return ok(file.text);
    } catch (error) {
      return fail([
        createPostinstallEsbuildErrorDiagnostic(
          packageName,
          entryFile,
          error instanceof Error ? error.message : String(error),
        ),
      ]);
    }
  }
}

