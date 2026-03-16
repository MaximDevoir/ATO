import { describe, expect, it } from 'vitest';
import {
  ATC_CLIENT_BOOTSTRAP_TEST,
  ATC_CLIENT_REQUEST_LOG_PREFIX,
  ATC_RUN_TESTS_COMMAND,
  ATO,
  createAutomationObservationState,
  formatAutomationSummaryLine,
  getATCIndexedClientBootstrapTest,
  getAutomationTotals,
  Orchestrator,
  OrchestratorMode,
  observeAutomationLogLine,
  parseATCClientRequestMetadataLine,
  resolveProcessExitCode,
  resolveProcessExitReason,
} from '../src/ATO';

function createPreview() {
  const session = new ATO({
    commandLineContext: {
      ueRoot: 'D:/uei/UE5.7.3/Engine',
      projectPath: 'D:/ue-projects/inv/inv.uproject',
      projectRoot: 'D:/ue-projects/inv',
    },
  });
  const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
    .configureServer({
      exe: 'D:/fake/invServer.exe',
      automaticallyApplyBootstrapTestsCmds: false,
      testExit: 'Automation Test Queue Empty',
    })
    .configureClient({
      exe: 'D:/fake/UnrealEditor-Cmd.exe',
      automaticallyApplyBootstrapTestsCmds: false,
    });
  session.addOrchestrator(orchestrator);
  const [preview] = session.preview();
  expect(preview).toBeTruthy();
  if (!preview) {
    throw new Error('Expected preview to be available once an orchestrator is configured');
  }
  return { session, orchestrator, preview };
}
function getPreview(session: ATO) {
  const [preview] = session.preview();
  expect(preview).toBeTruthy();
  if (!preview) {
    throw new Error('Expected preview to be available');
  }
  return preview;
}
function expectArgMissing(args: string[], expectedMissing: string) {
  expect(args.includes(expectedMissing), `did not expect arg ${expectedMissing} in ${JSON.stringify(args)}`).toBe(
    false,
  );
}
function expectArgMissingByPrefix(args: string[], expectedMissingPrefix: string) {
  expect(
    args.some((arg) => arg.startsWith(expectedMissingPrefix)),
    `did not expect an arg starting with ${expectedMissingPrefix} in ${JSON.stringify(args)}`,
  ).toBe(false);
}
describe('ATO', () => {
  it('removes excluded option names case-insensitively', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureServer({
      extraArgs: ['--version=3.0', '-VerSiOn', '--verSion', '14', '--verSion 15', '--help', '--height=100'],
      excludeArgs: ['-version', 'h'],
    });
    orchestrator.configureClient({
      extraArgs: ['--version=9.9', '--verSion 12', '--help'],
      excludeArgs: ['version'],
    });
    const preview = getPreview(session);
    expect(preview.server.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '--help',
      '--height=100',
      '-port=7777',
      '-testexit=Automation Test Queue Empty',
    ]);
    expect(preview.clientTemplate?.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      '--help',
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('keeps the last named extra arg across different representations', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureClient({
      extraArgs: ['--outFile=a.log', '-outFile', 'b.log', 'outFILE c.log', '--MAP=one', '-map', 'two'],
      excludeArgs: [],
    });
    const preview = getPreview(session);
    const args = preview.clientTemplate?.args ?? [];
    expect(args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      'outFILE c.log',
      '-map',
      'two',
      '-testexit=Automation Test Queue Empty',
    ]);
    expectArgMissing(args, '--outFile=a.log');
    expectArgMissing(args, 'b.log');
    expectArgMissing(args, '--MAP=one');
  });
  it('builds ExecCmds when only commands are supplied', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureClient({ execCmds: ['Automation List', 'quit'], execTests: [] });
    const preview = getPreview(session);
    expect(preview.clientTemplate?.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      '-game',
      '-stdout',
      '-FullStdOutLogOutputs',
      '-unattended',
      '-nosound',
      '-nullrhi',
      '-NoSplash',
      '-ExecCmds=Automation List; quit',
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('appends ExecTests after ExecCmds', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureClient({ execCmds: ['Automation List', 'quit'], execTests: ['AwesomeInventory', 'Smoke'] });
    const preview = getPreview(session);
    expect(preview.clientTemplate?.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      '-game',
      '-stdout',
      '-FullStdOutLogOutputs',
      '-unattended',
      '-nosound',
      '-nullrhi',
      '-NoSplash',
      `-ExecCmds=Automation List; quit; ${ATC_RUN_TESTS_COMMAND} AwesomeInventory* Smoke*`,
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('automatically appends ATC dedicated orchestrator identity and bootstrap tests by default', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
      .configureServer({ exe: 'D:/fake/invServer.exe' })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
      .addTests('AwesomeInventory.ATCMacro.Test')
      .configureRuntime({ clientCount: 1 });
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=DedicatedServer AwesomeInventory.ATCMacro.Test*`,
    );
    expect(preview.clients[0].args).toContain(`-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=0`);
  });
  it('does not auto-append ATC bootstrap tests when disabled', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
      .configureServer({
        exe: 'D:/fake/invServer.exe',
        execTests: ['AwesomeInventory.ATCMacro.Test'],
        automaticallyApplyBootstrapTestsCmds: false,
      })
      .configureClient({
        exe: 'D:/fake/UnrealEditor-Cmd.exe',
        automaticallyApplyBootstrapTestsCmds: false,
      })
      .configureRuntime({ clientCount: 1 });
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args).toContain(`-ExecCmds=${ATC_RUN_TESTS_COMMAND} AwesomeInventory.ATCMacro.Test*`);
    expectArgMissing(
      preview.server.args,
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=DedicatedServer AwesomeInventory.ATCMacro.Test*`,
    );
    expectArgMissingByPrefix(preview.clients[0].args, `-ExecCmds=${ATC_RUN_TESTS_COMMAND}`);
  });
  it('avoids duplicating explicit ATC bootstrap tests that are already present', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
      .configureServer({
        exe: 'D:/fake/invServer.exe',
        execTests: [
          'AwesomeInventory.ATCMacro.Test',
          'ZZZ.ATC.Orchestrator.DedicatedServer',
          'ZZZ.ATC.ClientBootstrap.Finish',
        ],
      })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe', execTests: [ATC_CLIENT_BOOTSTRAP_TEST] })
      .configureRuntime({ clientCount: 1 });
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);
    const serverExecCmds = preview.server.args.find((arg) => arg.startsWith('-ExecCmds='));
    const clientExecCmds = preview.clients[0].args.find((arg) => arg.startsWith('-ExecCmds='));

    expect(serverExecCmds).toContain(`${ATC_RUN_TESTS_COMMAND} --mode=DedicatedServer`);
    expect(serverExecCmds).toContain('AwesomeInventory.ATCMacro.Test*');
    expect(serverExecCmds).toContain('ZZZ.ATC.Orchestrator.DedicatedServer*');
    expect(serverExecCmds).toContain('ZZZ.ATC.ClientBootstrap.Finish*');
    expect(clientExecCmds).toContain(`${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=0`);
    expect(clientExecCmds).toContain(`${ATC_CLIENT_BOOTSTRAP_TEST}*`);
  });
  it('rewrites ATC bootstrap tests to the matching client slot for the first 32 clients', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureClient({
      automaticallyApplyBootstrapTestsCmds: true,
      execTests: [ATC_CLIENT_BOOTSTRAP_TEST],
    });
    orchestrator.configureRuntime({ clientCount: 33 });
    const preview = getPreview(session);

    expect(preview.clients[0].args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=0 ${ATC_CLIENT_BOOTSTRAP_TEST}*`,
    );
    expect(preview.clients[31].args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=31 ${ATC_CLIENT_BOOTSTRAP_TEST}*`,
    );
    expect(preview.clients[32].args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=32 ${ATC_CLIENT_BOOTSTRAP_TEST}*`,
    );
  });
  it('preserves already-explicit ATC bootstrap test names', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureClient({ execTests: [getATCIndexedClientBootstrapTest(7)] });

    const preview = getPreview(session);

    expect(preview.clientTemplate?.args).toContain(`-ExecCmds=${ATC_RUN_TESTS_COMMAND} ATC.ClientBootstrap.7*`);
  });
  it('uses standalone ATC orchestrator identity when configured without dedicated clients', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.Standalone)
      .configureServer({ exe: 'D:/fake/invServer.exe' })
      .addTests('AwesomeInventory.ATCMacro.Test');
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Standalone AwesomeInventory.ATCMacro.Test*`,
    );
    expect(preview.server.args).toContain('-game');
    expectArgMissing(preview.server.args, '-port=7777');
    expect(preview.clients).toHaveLength(0);
  });
  it('suppresses UnrealLag preview for standalone orchestration', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.Standalone)
      .configureServer({ exe: 'D:/fake/inv.exe' })
      .addTests('AwesomeInventoryStandalone.BasicStandaloneTest')
      .configureUnrealLag({
        bindAddress: '127.0.0.1',
        bindPort: 0,
        serverProfile: 'Bad',
        clientProfile: 'Bad',
      });
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.unrealLag).toBeUndefined();
  });
  it('uses ATC-managed listen orchestration without requiring a startup map', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.ListenServer)
      .configureServer({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
      .configureRuntime({ clientCount: 1 })
      .configureUnrealLag({
        bindAddress: '127.0.0.1',
        bindPort: 0,
        serverProfile: 'Bad',
        clientProfile: 'Bad',
      })
      .addTests('AwesomeInventory.ATCMacro.PARALLEL_TEST');
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args[0]).toBe('D:/ue-projects/inv/inv.uproject');
    expect(preview.server.args.some((arg) => arg.includes('?listen'))).toBe(false);
    expect(preview.server.args).toContain('-game');
    expect(preview.server.args).toContain('-port=7777');
    expect(preview.server.args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=ListenServer AwesomeInventory.ATCMacro.PARALLEL_TEST*`,
    );
    expect(preview.clients).toHaveLength(1);
    expect(preview.clients[0].args).toContain(`-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=0`);
    expect(preview.unrealLag).toBeTruthy();
  });
  it('still appends ?listen when an explicit listen startup map is provided', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.ListenServer)
      .configureServer({
        exe: 'D:/fake/UnrealEditor-Cmd.exe',
        startupMap: '/Game/ThirdPerson/Lvl_ThirdPerson',
      })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
      .configureRuntime({ clientCount: 1 })
      .addTests('AwesomeInventory.ATCMacro.PARALLEL_TEST');
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args).toContain('/Game/ThirdPerson/Lvl_ThirdPerson?listen');
  });
  it('lets generated args override earlier user-supplied ones', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureServer({
      extraArgs: ['--testexit=User Override', '--ExecCmds=Automation RunTest Old'],
      excludeArgs: [],
      execCmds: ['Automation List'],
      execTests: ['AwesomeInventory'],
      testExit: 'Automation Test Queue Empty',
    });
    const preview = getPreview(session);
    expect(preview.server.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '-port=7777',
      `-ExecCmds=Automation List; ${ATC_RUN_TESTS_COMMAND} AwesomeInventory*`,
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('parses ATC client-request metadata lines', () => {
    expect(
      parseATCClientRequestMetadataLine(
        `[8:37:40 AM] LogTemp: Display: ${ATC_CLIENT_REQUEST_LOG_PREFIX}{"fixturePath":"AwesomeInventory.ATCMacro.PARALLEL_TEST","requiredClients":1}`,
      ),
    ).toEqual({
      fixturePath: 'AwesomeInventory.ATCMacro.PARALLEL_TEST',
      requiredClients: 1,
    });
  });
  it('ignores malformed ATC client-request metadata lines', () => {
    expect(
      parseATCClientRequestMetadataLine(`${ATC_CLIENT_REQUEST_LOG_PREFIX}{"fixturePath":"","requiredClients":1}`),
    ).toBeUndefined();
    expect(
      parseATCClientRequestMetadataLine(
        `${ATC_CLIENT_REQUEST_LOG_PREFIX}{"fixturePath":"Fixture","requiredClients":-1}`,
      ),
    ).toBeUndefined();
    expect(parseATCClientRequestMetadataLine(`${ATC_CLIENT_REQUEST_LOG_PREFIX}not-json`)).toBeUndefined();
  });
  it('uses Unreal travel-style separators when appending listen to startup maps with existing options', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.ListenServer)
      .configureServer({
        exe: 'D:/fake/UnrealEditor-Cmd.exe',
        startupMap:
          '/Game/ThirdPerson/Lvl_ThirdPerson?game=/Game/ThirdPerson/Blueprints/BP_ThirdPersonGameMode.BP_ThirdPersonGameMode_C',
      })
      .addTests('AwesomeInventory.ATCMacro.PARALLEL_TEST');
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.server.args).toContain(
      '/Game/ThirdPerson/Lvl_ThirdPerson?game=/Game/ThirdPerson/Blueprints/BP_ThirdPersonGameMode.BP_ThirdPersonGameMode_C?listen',
    );
  });
  it('shows an unbounded client template when no max client count is configured', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });
    const orchestrator = new Orchestrator(OrchestratorMode.DedicatedServer)
      .configureServer({ exe: 'D:/fake/invServer.exe' })
      .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
      .addTests('AwesomeInventory.ATCMacro.Test');
    session.addOrchestrator(orchestrator);

    const preview = getPreview(session);

    expect(preview.maxExternalClients).toBe('unbounded');
    expect(preview.clientTemplate?.args).toContain(`-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Client --clientIndex=0`);
    expect(preview.clients).toHaveLength(0);
  });
  it('supports multiple orchestrators in a single ATO session', () => {
    const session = new ATO({
      commandLineContext: {
        ueRoot: 'D:/uei/UE5.7.3/Engine',
        projectPath: 'D:/ue-projects/inv/inv.uproject',
        projectRoot: 'D:/ue-projects/inv',
      },
    });

    session
      .addOrchestrator(
        new Orchestrator(OrchestratorMode.DedicatedServer)
          .configureServer({ exe: 'D:/fake/invServer.exe' })
          .configureClient({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
          .configureRuntime({ clientCount: 1 })
          .addTests('AwesomeInventory.ATCMacro.Test'),
      )
      .addOrchestrator(
        new Orchestrator(OrchestratorMode.Standalone)
          .configureServer({ exe: 'D:/fake/UnrealEditor-Cmd.exe' })
          .addTests('AwesomeInventoryStandalone.BasicStandaloneTest'),
      );

    const previews = session.preview();

    expect(previews).toHaveLength(2);
    expect(previews[0]?.server.args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=DedicatedServer AwesomeInventory.ATCMacro.Test*`,
    );
    expect(previews[1]?.server.args).toContain(
      `-ExecCmds=${ATC_RUN_TESTS_COMMAND} --mode=Standalone AwesomeInventoryStandalone.BasicStandaloneTest*`,
    );
  });
  it('omits the generated testexit arg when disabled', () => {
    const { session, orchestrator } = createPreview();
    orchestrator.configureServer({ testExit: undefined });
    const preview = getPreview(session);
    expectArgMissingByPrefix(preview.server.args, '-testexit=');
  });
  it('treats automation success as queue drain plus positive test count', () => {
    const automation = createAutomationObservationState(true);
    observeAutomationLogLine(
      automation,
      "[7:04:33 AM] LogAutomationCommandLine: Display: Found 1 automation tests based on 'AwesomeInventory.Multiplayer.Connection'",
    );
    observeAutomationLogLine(
      automation,
      '[7:04:33 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={Connection} Path={AwesomeInventory.Multiplayer.Connection}',
    );
    observeAutomationLogLine(
      automation,
      '[7:04:33 AM] LogAutomationCommandLine: Display: ...Automation Test Queue Empty 1 tests performed.',
    );
    expect(getAutomationTotals(automation)).toEqual({ passed: 1, total: 1 });
    expect(formatAutomationSummaryLine('CLIENT 1', automation)).toBe('Client 1 | Passed 1/1');
    expect(formatAutomationSummaryLine('DEDICATED', automation)).toBe('Dedicated | Passed 1/1');
    expect(formatAutomationSummaryLine('LISTEN', automation)).toBe('Listen | Passed 1/1');
    expect(formatAutomationSummaryLine('STANDALONE', automation)).toBe('Standalone | Passed 1/1');
    expect(resolveProcessExitCode(0, automation)).toBe(0);
    expect(resolveProcessExitReason(0, automation)).toBe('automation passed (1 test performed)');
  });
  it('synthesizes a failing exit code for failed automation results', () => {
    const automation = createAutomationObservationState(true);
    observeAutomationLogLine(
      automation,
      "[7:01:52 AM] LogAutomationCommandLine: Display: Found 2 automation tests based on 'AwesomeInventory'",
    );
    observeAutomationLogLine(
      automation,
      '[7:01:52 AM] LogAutomationController: Display: Test Completed. Result={Success} Name={Connection} Path={AwesomeInventory.Multiplayer.Connection}',
    );
    observeAutomationLogLine(
      automation,
      '[7:01:52 AM] LogAutomationController: Error: Test Completed. Result={Fail} Name={Inventory} Path={AwesomeInventory.Inventory.Broken}',
    );
    observeAutomationLogLine(
      automation,
      '[7:01:52 AM] LogAutomationCommandLine: Display: ...Automation Test Queue Empty 2 tests performed.',
    );
    expect(getAutomationTotals(automation)).toEqual({ passed: 1, total: 2 });
    expect(formatAutomationSummaryLine('CLIENT 1', automation)).toBe('Client 1 | Passed 1/2');
    expect(automation.unsuccessfulTests).toEqual([
      {
        result: 'Fail',
        name: 'Inventory',
        path: 'AwesomeInventory.Inventory.Broken',
      },
    ]);
    expect(resolveProcessExitCode(0, automation)).toBe(1);
    expect(resolveProcessExitReason(0, automation)).toBe('automation completed with result Fail');
  });
  it('fails zero-test automation even when the process exits cleanly', () => {
    const automation = createAutomationObservationState(true);
    observeAutomationLogLine(
      automation,
      "[7:01:52 AM] LogAutomationCommandLine: Display: Found 0 automation tests based on 'Missing.Test'",
    );
    observeAutomationLogLine(
      automation,
      '[7:01:52 AM] LogAutomationCommandLine: Display: ...Automation Test Queue Empty 0 tests performed.',
    );
    expect(getAutomationTotals(automation)).toEqual({ passed: 0, total: 0 });
    expect(formatAutomationSummaryLine('CLIENT 2', automation)).toBe('Client 2 | Passed 0/0');
    expect(resolveProcessExitCode(0, automation)).toBe(1);
    expect(resolveProcessExitReason(0, automation)).toBe('no matching automation tests were found');
  });
  it('keeps raw exit behavior for non-automation processes', () => {
    const automation = createAutomationObservationState(false);
    expect(formatAutomationSummaryLine('SERVER', automation)).toBeUndefined();
    expect(resolveProcessExitCode(0, automation)).toBe(0);
    expect(resolveProcessExitReason(0, automation)).toBe('process exited cleanly');
    expect(resolveProcessExitCode(5, automation)).toBe(5);
    expect(resolveProcessExitReason(5, automation)).toBe('process exited with code 5');
    expect(resolveProcessExitCode('timeout', automation)).toBe(1);
    expect(resolveProcessExitReason('timeout', automation)).toBe('process timed out');
  });
});
