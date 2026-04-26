import type { HarnessCreationResult } from '../domain/HarnessCreationResult.js';
import type { HarnessCreationSettings } from '../domain/HarnessCreationSettings.js';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle.js';

export interface HarnessCreator {
  readonly name: string;
  canAcceptHarness(harnessString: string): boolean;
  executeHarnessCreation(
    settings: HarnessCreationSettings,
    result: HarnessCreationResult,
    liveStatus: LiveStatusHandle,
  ): Promise<void>;
}
