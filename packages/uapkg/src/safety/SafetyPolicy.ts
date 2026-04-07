import type { LockedPackage } from '../lockfile/UAPKGLockfile.js';
import type { GitRepositoryState } from '../services/GitClient.js';

export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
}

export class SafetyPolicy {
  canUpdatePackage(
    existingLock: LockedPackage | undefined,
    currentState: GitRepositoryState | undefined,
    force: boolean,
  ): SafetyDecision {
    if (force) {
      return { allowed: true };
    }

    if (!currentState) {
      return { allowed: true };
    }

    if (!currentState.isRepository) {
      return { allowed: true };
    }

    if (currentState.isDirty) {
      return {
        allowed: false,
        reason: 'local repository has uncommitted changes',
      };
    }

    if (!existingLock) {
      if (currentState.branch && currentState.branch !== 'HEAD') {
        return {
          allowed: false,
          reason: `local repository is on branch '${currentState.branch}' and not tracked in lockfile`,
        };
      }
      return { allowed: true };
    }

    if (currentState.remoteUrl && currentState.remoteUrl !== existingLock.source) {
      return {
        allowed: false,
        reason: `source drift: lock=${existingLock.source}, local=${currentState.remoteUrl}`,
      };
    }

    if (currentState.commit && currentState.commit !== existingLock.hash) {
      return {
        allowed: false,
        reason: `hash drift: lock=${existingLock.hash}, local=${currentState.commit}`,
      };
    }

    if (currentState.branch && currentState.branch !== 'HEAD' && currentState.branch !== existingLock.version) {
      return {
        allowed: false,
        reason: `branch drift: lock=${existingLock.version}, local=${currentState.branch}`,
      };
    }

    return { allowed: true };
  }
}
