import { describe, expect, it } from 'vitest';
import { ATO, Orchestrator, OrchestratorMode } from '../src/ATO';

describe('debug preview', () => {
  it('client default includes LiveCoding flag', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/proj/proj.uproject',
        projectRoot: 'D:/ue-projects/proj',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
      .configureServer({
        exe: 'D:/fake/projServer.exe',
        automaticallyApplyBootstrapTestsCmds: false,
        testExit: 'Automation Test Queue Empty',
      })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe', automaticallyApplyBootstrapTestsCmds: false });
    session.addOrchestrator(orchestrator);

    orchestrator.configureClient({ execCmds: ['Automation List', 'quit'], execTests: [] });
    const [preview] = session.preview();
    expect(preview.clientTemplate?.args).toContain('-LiveCoding=0');
  });
});
