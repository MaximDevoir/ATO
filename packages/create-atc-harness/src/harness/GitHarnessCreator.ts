import type { HarnessCreationResult } from '../domain/HarnessCreationResult';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';
import type { GitService } from '../services/GitService';
import { isGitLikeReference, parseGitReference } from '../services/GitUrl';
import type { HarnessCreator } from './HarnessCreator';

export class GitHarnessCreator implements HarnessCreator {
  readonly name = 'Git';

  constructor(private readonly gitService: GitService) {}

  canAcceptHarness(harnessString: string) {
    return isGitLikeReference(harnessString) && this.gitService.isGitAvailable();
  }

  async executeHarnessCreation(
    settings: HarnessCreationSettings,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ) {
    const gitReference = parseGitReference(settings.harnessString);
    const refInfo = gitReference.ref ? ` @ ${gitReference.ref}` : '';
    liveStatus.setStatus(`[Harness/Git] Cloning ${gitReference.repositoryUrl}${refInfo}`);
    await this.gitService.clone(gitReference.repositoryUrl, settings.rootFolder, gitReference.ref);

    if (!this.gitService.hasLfsTracking(settings.rootFolder)) {
      result.addLog('[Harness/Git] No Git LFS tracking detected');
      return;
    }

    if (!this.gitService.isGitLfsAvailable()) {
      result.addError('[Harness/Git] Repository uses Git LFS but git lfs is unavailable');
      return;
    }

    liveStatus.setStatus('[Harness/Git] Git LFS detected; pulling LFS content...');
    await this.gitService.pullLfs(settings.rootFolder);
    result.addLog('[Harness/Git] Git LFS content pulled successfully');
  }
}
