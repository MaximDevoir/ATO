import type { HarnessCreationResult } from '../domain/HarnessCreationResult';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';

export interface HarnessCreator {
  readonly name: string;
  canAcceptHarness(harnessString: string): boolean;
  executeHarnessCreation(
    settings: HarnessCreationSettings,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ): Promise<void>;
}
