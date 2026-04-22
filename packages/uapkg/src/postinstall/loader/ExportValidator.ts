import {
  type Result,
  ok,
  fail,
  createPostinstallInvalidExportDiagnostic,
} from '@uapkg/diagnostics';
import { type PostinstallDefinition, PostinstallDefinitionSchema } from '../api/PostinstallDsl.js';

/**
 * Normalizes an imported module to its default export (or the module object
 * itself for CommonJS-style returns) and validates against
 * {@link PostinstallDefinitionSchema}.
 *
 * Emits `POSTINSTALL_INVALID_EXPORT` with flattened Zod issue messages when
 * the shape is wrong.
 */
export class ExportValidator {
  public validate(packageName: string, entryFile: string, moduleValue: unknown): Result<PostinstallDefinition> {
    const unwrapped = this.unwrap(moduleValue);
    const parsed = PostinstallDefinitionSchema.safeParse(unwrapped);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => {
        const where = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
        return `${issue.message}${where}`;
      });
      return fail([createPostinstallInvalidExportDiagnostic(packageName, entryFile, issues)]);
    }
    return ok(parsed.data);
  }

  private unwrap(moduleValue: unknown): unknown {
    if (moduleValue && typeof moduleValue === 'object') {
      const record = moduleValue as Record<string, unknown>;
      if ('default' in record) return record.default;
      return record;
    }
    return moduleValue;
  }
}

