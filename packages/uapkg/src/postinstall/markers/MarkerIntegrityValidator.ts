/**
 * Detects corruption in UAPKG marker blocks for a single `(pluginName, zone)`
 * owning pair. Corruption rules (scoped to the owning pair — foreign plugins'
 * blocks are ignored on purpose):
 *
 *   1. `UAPKG-BEGIN X:Z` with no matching `UAPKG-END X:Z` after it
 *      → `orphaned-begin`.
 *   2. `UAPKG-END X:Z` with no preceding `UAPKG-BEGIN X:Z`
 *      → `orphaned-end`.
 *   3. Two `UAPKG-BEGIN X:Z` before any `UAPKG-END X:Z`
 *      → `nested-begin`.
 *
 * The validator is a pure function — no I/O, no mutation, no exceptions. It
 * returns the first violation encountered so callers can surface exactly one
 * diagnostic per file.
 */
export interface MarkerIntegrityOk {
  readonly ok: true;
}

export interface MarkerIntegrityFail {
  readonly ok: false;
  readonly reason: string;
  readonly line: number;
}

export type MarkerIntegrityResult = MarkerIntegrityOk | MarkerIntegrityFail;

export class MarkerIntegrityValidator {
  public validate(source: string, pluginName: string, zone: string): MarkerIntegrityResult {
    const beginToken = `UAPKG-BEGIN ${pluginName}:${zone}`;
    const endToken = `UAPKG-END ${pluginName}:${zone}`;
    const lines = source.split(/\r?\n/);

    let depth = 0;
    let lastBeginLine = -1;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const hasBegin = line.includes(beginToken);
      const hasEnd = line.includes(endToken);

      if (hasBegin && hasEnd) {
        // Same-line BEGIN+END is not a shape we emit; treat as malformed.
        return {
          ok: false,
          reason: `BEGIN and END on same line at line ${i + 1}`,
          line: i + 1,
        };
      }

      if (hasBegin) {
        if (depth >= 1) {
          return {
            ok: false,
            reason: `nested BEGIN at line ${i + 1} (previous BEGIN at line ${lastBeginLine + 1} was not closed)`,
            line: i + 1,
          };
        }
        depth += 1;
        lastBeginLine = i;
        continue;
      }

      if (hasEnd) {
        if (depth === 0) {
          return {
            ok: false,
            reason: `orphaned END at line ${i + 1} (no preceding BEGIN)`,
            line: i + 1,
          };
        }
        depth -= 1;
      }
    }

    if (depth > 0) {
      return {
        ok: false,
        reason: `orphaned BEGIN at line ${lastBeginLine + 1} (missing END)`,
        line: lastBeginLine + 1,
      };
    }

    return { ok: true };
  }
}

