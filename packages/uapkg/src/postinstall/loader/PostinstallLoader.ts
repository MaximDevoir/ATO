import { fail, ok, type Result } from '@uapkg/diagnostics';
import type { PostinstallDefinition } from '../api/PostinstallDsl.js';
import { EntryResolver, type ResolvedEntry } from './EntryResolver.js';
import { EsbuildTranspiler } from './EsbuildTranspiler.js';
import { ExportValidator } from './ExportValidator.js';
import { ModuleImporter, type ModuleSource } from './ModuleImporter.js';

export interface LoadedPostinstall {
  readonly packageName: string;
  readonly pluginRoot: string;
  readonly entryFile: string;
  readonly definition: PostinstallDefinition;
}

/**
 * Facade that composes the four loader stages:
 *   1. {@link EntryResolver}        locate `.uapkg/postinstall.<ext>`
 *   2. {@link EsbuildTranspiler}    if `.ts`, transpile to ESM
 *   3. {@link ModuleImporter}       dynamic import → raw module value
 *   4. {@link ExportValidator}      Zod-validate default export
 *
 * Returns `ok(null)` when a plugin has no postinstall — a valid, silent state.
 * Never throws: every stage returns `Result`.
 */
export class PostinstallLoader {
  public constructor(
    private readonly entryResolver: EntryResolver = new EntryResolver(),
    private readonly transpiler: EsbuildTranspiler = new EsbuildTranspiler(),
    private readonly importer: ModuleImporter = new ModuleImporter(),
    private readonly validator: ExportValidator = new ExportValidator(),
  ) {}

  public async load(packageName: string, pluginRoot: string): Promise<Result<LoadedPostinstall | null>> {
    const entryResult = this.entryResolver.resolve(packageName, pluginRoot);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    if (entry === null) return ok(null);

    const sourceResult = await this.buildModuleSource(packageName, entry);
    if (!sourceResult.ok) return sourceResult;

    const importResult = await this.importer.import(packageName, sourceResult.value);
    if (!importResult.ok) return importResult;

    const validated = this.validator.validate(packageName, entry.path, importResult.value);
    if (!validated.ok) return validated;

    return ok({
      packageName,
      pluginRoot,
      entryFile: entry.path,
      definition: validated.value,
    });
  }

  private async buildModuleSource(packageName: string, entry: ResolvedEntry): Promise<Result<ModuleSource>> {
    if (entry.kind !== 'ts') {
      return ok({ kind: 'file', path: entry.path });
    }
    const transpiled = await this.transpiler.transpile(packageName, entry.path);
    if (!transpiled.ok) return fail(transpiled.diagnostics);
    return ok({ kind: 'transpiled', code: transpiled.value, originalPath: entry.path });
  }
}
