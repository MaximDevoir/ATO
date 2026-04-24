export type LockfileSyncIssueSeverity = 'error' | 'warning' | 'info';

export interface LockfileSyncIssue {
  readonly severity: LockfileSyncIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly packageName?: string;
}

const SEVERITY_ORDER: Readonly<Record<LockfileSyncIssueSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function sortLockfileSyncIssues(issues: readonly LockfileSyncIssue[]): LockfileSyncIssue[] {
  return [...issues].sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.code.localeCompare(b.code);
  });
}
