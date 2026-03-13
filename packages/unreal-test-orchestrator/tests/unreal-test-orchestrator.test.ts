import { describe, expect, it } from 'vitest';
import {
  createAutomationObservationState,
  formatAutomationSummaryLine,
  getAutomationTotals,
  observeAutomationLogLine,
  resolveProcessExitCode,
  resolveProcessExitReason,
  UnrealTestOrchestrator,
} from '../src/UnrealTestOrchestrator';
import { RuntimePresets } from '../src/UnrealTestOrchestrator.options';

function createPreview() {
  const orchestrator = new UnrealTestOrchestrator({
    commandLineContext: {
      ueRoot: 'D:/uei/UE5.7.3/Engine',
      projectPath: 'D:/ue-projects/inv/inv.uproject',
      projectRoot: 'D:/ue-projects/inv',
    },
  });
  const server = RuntimePresets.Server(orchestrator.projectPath, 'D:/fake/invServer.exe');
  const client = RuntimePresets.Client(orchestrator.projectPath, '127.0.0.1', 'D:/fake/UnrealEditor-Cmd.exe');
  orchestrator.configureServer(server);
  orchestrator.addClient(client);
  const preview = orchestrator.preview();
  expect(preview).toBeTruthy();
  if (!preview) {
    throw new Error('Expected preview to be available once server is configured');
  }
  return { orchestrator, server, client, preview };
}
function getPreview(orchestrator: UnrealTestOrchestrator) {
  const preview = orchestrator.preview();
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
describe('UnrealTestOrchestrator', () => {
  it('removes excluded option names case-insensitively', () => {
    const { orchestrator, server, client } = createPreview();
    server.extraArgs = ['--version=3.0', '-VerSiOn', '--verSion', '14', '--verSion 15', '--help', '--height=100'];
    server.excludeArgs = ['-version', 'h'];
    client.extraArgs = ['--version=9.9', '--verSion 12', '--help'];
    client.excludeArgs = ['version'];
    const preview = getPreview(orchestrator);
    expect(preview.server.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '--help',
      '--height=100',
      '-port=7777',
      '-testexit=Automation Test Queue Empty',
    ]);
    expect(preview.clients[0].args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      '--help',
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('keeps the last named extra arg across different representations', () => {
    const { orchestrator, client } = createPreview();
    client.extraArgs = ['--outFile=a.log', '-outFile', 'b.log', 'outFILE c.log', '--MAP=one', '-map', 'two'];
    client.excludeArgs = [];
    const preview = getPreview(orchestrator);
    const args = preview.clients[0].args;
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
    const { orchestrator, client } = createPreview();
    client.execCmds = ['Automation List', 'quit'];
    client.execTests = [];
    const preview = getPreview(orchestrator);
    expect(preview.clients[0].args).toEqual([
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
    const { orchestrator, client } = createPreview();
    client.execCmds = ['Automation List', 'quit'];
    client.execTests = ['AwesomeInventory', 'Smoke'];
    const preview = getPreview(orchestrator);
    expect(preview.clients[0].args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '127.0.0.1',
      '-game',
      '-stdout',
      '-FullStdOutLogOutputs',
      '-unattended',
      '-nosound',
      '-nullrhi',
      '-NoSplash',
      '-ExecCmds=Automation List; quit; Automation RunTests AwesomeInventory$+Smoke$',
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('rewrites ATC bootstrap tests to the matching client slot for the first 32 clients', () => {
    const { orchestrator, client } = createPreview();
    client.execTests = ['ATC.ClientBootstrap'];
    orchestrator.configureRuntime({ clientCount: 33 });
    const preview = getPreview(orchestrator);

    expect(preview.clients[0].args).toContain('-ExecCmds=Automation RunTests ATC.ClientBootstrap.0$');
    expect(preview.clients[31].args).toContain('-ExecCmds=Automation RunTests ATC.ClientBootstrap.31$');
    expect(preview.clients[32].args).toContain('-ExecCmds=Automation RunTests ATC.ClientBootstrap$');
  });
  it('preserves already-explicit ATC bootstrap test names', () => {
    const { orchestrator, client } = createPreview();
    client.execTests = ['ATC.ClientBootstrap.7'];

    const preview = getPreview(orchestrator);

    expect(preview.clients[0].args).toContain('-ExecCmds=Automation RunTests ATC.ClientBootstrap.7$');
  });
  it('lets generated args override earlier user-supplied ones', () => {
    const { orchestrator, server } = createPreview();
    server.extraArgs = ['--testexit=User Override', '--ExecCmds=Automation RunTest Old'];
    server.excludeArgs = [];
    server.execCmds = ['Automation List'];
    server.execTests = ['AwesomeInventory'];
    server.testExit = 'Automation Test Queue Empty';
    const preview = getPreview(orchestrator);
    expect(preview.server.args).toEqual([
      'D:/ue-projects/inv/inv.uproject',
      '-port=7777',
      '-ExecCmds=Automation List; Automation RunTests AwesomeInventory$',
      '-testexit=Automation Test Queue Empty',
    ]);
  });
  it('omits the generated testexit arg when disabled', () => {
    const { orchestrator, server } = createPreview();
    server.testExit = undefined;
    const preview = getPreview(orchestrator);
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
