import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATO, Orchestrator, OrchestratorMode } from './../src/ATO';

describe('debug pie check', () => {
  it('resolves PIE executable to engine UnrealEditor when UERoot is provided', () => {
    const argv = [
      'node',
      'script',
      '--UERoot',
      'D:/dummy/Engine',
      '--Project',
      'D:/ue-projects/ATC_TEST_ENV/TemplateProject/TemplateProject.uproject',
    ];
    const ato = ATO.fromCommandLine({ argv });
    const orchestrator = new Orchestrator(OrchestratorMode.PIE);
    ato.addOrchestrator(orchestrator);

    const [preview] = ato.preview();
    expect(preview).toBeTruthy();
    if (!preview) throw new Error('Expected preview to be available');

    const expected = path.join('D:/dummy/Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    expect(preview.server.exe).toBe(expected);
  });
});
