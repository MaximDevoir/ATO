import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ATIService, InMemoryConsumer, NDJSONConsumer } from '../src';

const cleanupPaths: string[] = [];

afterEach(async () => {
  while (cleanupPaths.length > 0) {
    const target = cleanupPaths.pop();
    if (!target) {
      continue;
    }

    await rm(target, { recursive: true, force: true });
  }
});

function writeEvents(endpoint: { host: string; port: number }, lines: string[]) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(endpoint.port, endpoint.host, () => {
      socket.write(`${lines.join('\n')}\n`);
      socket.end();
    });

    socket.once('error', reject);
    socket.once('close', () => resolve());
  });
}

describe('ATIService', () => {
  it('accepts TCP NDJSON events and fans them out to consumers', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ati-service-'));
    cleanupPaths.push(tempDir);

    const service = new ATIService({ host: '127.0.0.1', port: 0, validateSchema: true });
    const memory = new InMemoryConsumer();
    const ndjson = new NDJSONConsumer({ directory: tempDir });
    service.addConsumer(memory).addConsumer(ndjson);

    await service.start();
    const endpoint = service.getEndpoint();

    await writeEvents(endpoint, [
      JSON.stringify({
        version: 1,
        sessionId: 'session-1',
        sequence: 0,
        timestamp: 1.0,
        type: 'TestStarted',
        testPath: 'ATC.Sample',
        invocationIndex: 0,
        requiredClients: 0,
      }),
      JSON.stringify({
        version: 1,
        sessionId: 'session-1',
        sequence: 1,
        timestamp: 2.0,
        type: 'TaskResult',
        testPath: 'ATC.Sample',
        planName: 'PlanA',
        taskName: 'TaskA',
        success: true,
        skipped: false,
      }),
    ]);

    await service.stop();

    expect(memory.sessions).toHaveLength(1);
    expect(memory.events).toHaveLength(4);
    expect(memory.events[0]?.type).toBe('SessionStarted');
    expect(memory.events[1]?.type).toBe('TestStarted');
    expect(memory.events[2]?.type).toBe('TaskResult');
    expect(memory.events[3]?.type).toBe('SessionFinished');

    const ndjsonPath = path.join(tempDir, 'session_session-1.ndjson');
    const contents = await readFile(ndjsonPath, 'utf8');
    expect(contents.split('\n').find((line) => line.length > 0)).toContain('"type":"SessionStarted"');
    expect(contents).toContain('"type":"TestStarted"');
    expect(contents).toContain('"type":"TaskResult"');
    expect(contents.trimEnd().endsWith('"type":"SessionFinished","durationSeconds":1}')).toBe(true);
  });

  it('starts a new consumer session when a different session id is observed', async () => {
    const service = new ATIService({ host: '127.0.0.1', port: 0, validateSchema: true });
    const memory = new InMemoryConsumer();
    service.addConsumer(memory);

    await service.start();
    const endpoint = service.getEndpoint();

    await writeEvents(endpoint, [
      JSON.stringify({ version: 1, sessionId: 'session-a', sequence: 0, timestamp: 1, type: 'TestStarted' }),
      JSON.stringify({ version: 1, sessionId: 'session-b', sequence: 0, timestamp: 2, type: 'TestStarted' }),
    ]);

    await service.stop();

    expect(memory.sessions.map((session) => session.sessionId)).toEqual(['session-a', 'session-b']);
    expect(memory.events.map((event) => event.type)).toEqual([
      'SessionStarted',
      'TestStarted',
      'SessionFinished',
      'SessionStarted',
      'TestStarted',
      'SessionFinished',
    ]);
  });
});
