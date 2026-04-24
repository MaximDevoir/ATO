import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createManifestWriteErrorDiagnostic, DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { LockfileSyncIssue } from '../core/LockfileSyncIssue.js';

/**
 * Persists detailed lockfile sync issues to disk for large diagnostic sets.
 */
export class LockfileSyncIssueWriter {
  public async write(manifestRoot: string, issues: readonly LockfileSyncIssue[]): Promise<Result<string>> {
    const bag = new DiagnosticBag();
    const logPath = this.resolveLogPath(manifestRoot);

    try {
      const logDir = logPath.replace(/[/\\][^/\\]+$/, '');
      if (!existsSync(logDir)) {
        await mkdir(logDir, { recursive: true });
      }

      const lines = issues.map((issue, index) => {
        const packageText = issue.packageName ? ` [${issue.packageName}]` : '';
        return `${index + 1}. [${issue.severity.toUpperCase()} ${issue.code}]${packageText} ${issue.message}`;
      });

      await writeFile(logPath, `${lines.join('\n')}\n`, 'utf-8');
      return ok(logPath);
    } catch (err) {
      bag.add(createManifestWriteErrorDiagnostic(logPath, String(err)));
      return bag.toFailure();
    }
  }

  private resolveLogPath(manifestRoot: string): string {
    const now = new Date();
    const timestamp = [
      now.getUTCFullYear().toString().padStart(4, '0'),
      (now.getUTCMonth() + 1).toString().padStart(2, '0'),
      now.getUTCDate().toString().padStart(2, '0'),
      '-',
      now.getUTCHours().toString().padStart(2, '0'),
      now.getUTCMinutes().toString().padStart(2, '0'),
      now.getUTCSeconds().toString().padStart(2, '0'),
    ].join('');
    return join(manifestRoot, '.uapkg', 'logs', `lockfile-sync-${timestamp}.log`);
  }
}
