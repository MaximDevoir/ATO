import fs from 'node:fs';
import * as path from 'node:path';
import { createPostinstallDuplicateEntryDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';

/** Candidate extensions in resolution order (spec-mandated). */
const CANDIDATE_EXTENSIONS = ['ts', 'js', 'mjs'] as const;
export type PostinstallEntryKind = (typeof CANDIDATE_EXTENSIONS)[number];

export interface ResolvedEntry {
  readonly path: string;
  readonly kind: PostinstallEntryKind;
}

/**
 * Locates `.uapkg/postinstall.<ext>` inside a plugin root, enforcing the
 * order `ts → js → mjs`. If the plugin has two or more candidate files an
 * error diagnostic `POSTINSTALL_DUPLICATE_ENTRY` is returned so the user can
 * clean up ambiguity. `ok(null)` means "no postinstall defined" — a valid,
 * silent state.
 */
export class EntryResolver {
  public resolve(packageName: string, pluginRoot: string): Result<ResolvedEntry | null> {
    const dir = path.join(pluginRoot, '.uapkg');
    if (!fs.existsSync(dir)) return ok(null);

    const found: ResolvedEntry[] = [];
    for (const kind of CANDIDATE_EXTENSIONS) {
      const candidate = path.join(dir, `postinstall.${kind}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        found.push({ path: candidate, kind });
      }
    }

    if (found.length === 0) return ok(null);
    if (found.length > 1) {
      return fail([
        createPostinstallDuplicateEntryDiagnostic(
          packageName,
          found.map((entry) => entry.path),
        ),
      ]);
    }
    return ok(found[0]);
  }
}
