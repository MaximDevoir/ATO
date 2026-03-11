import * as dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  createExampleUnrealLag,
  logWarningIfNetworkProfileUnstable,
  resolvePeerSelection,
  SequenceCounter,
  UnrealLag,
  UnrealLagProfiles,
} from '../src/index';

function closeSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    try {
      socket.close(() => resolve());
    } catch {
      resolve();
    }
  });
}
function bindSocket(
  socket: dgram.Socket,
  port: number,
  address = '127.0.0.1',
): Promise<{ address: string; port: number }> {
  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, address, () => {
      const info = socket.address() as AddressInfo;
      resolve({ address: info.address, port: info.port });
    });
  });
}
function waitForMessage(socket: dgram.Socket, timeoutMs: number): Promise<{ msg: Buffer; rinfo: dgram.RemoteInfo }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`Timed out waiting for UDP message after ${timeoutMs}ms`));
    }, timeoutMs);
    const onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      clearTimeout(timeout);
      socket.off('message', onMessage);
      resolve({ msg, rinfo });
    };
    socket.on('message', onMessage);
  });
}
async function createEchoServer() {
  const socket = dgram.createSocket('udp4');
  const info = await bindSocket(socket, 0);
  socket.on('message', (msg, rinfo) => {
    socket.send(msg, rinfo.port, rinfo.address);
  });
  return { socket, info };
}
describe('UnrealLag', () => {
  it('resolves profiles with overrides', () => {
    const resolved = resolvePeerSelection(
      'client-a',
      {
        profile: 'Good',
        outbound: { latencyMs: 45 },
      },
      undefined,
    );
    expect(resolved.id).toBe('client-a');
    expect(resolved.inbound.lossPct).toBe(0.05);
    expect(resolved.inbound.latencyMs).toBe(30);
    expect(resolved.outbound.lossPct).toBe(0.05);
    expect(resolved.outbound.latencyMs).toBe(45);
  });
  it('starts from the example helper', async () => {
    const proxy = createExampleUnrealLag({ bindPort: 0 });
    try {
      const bindInfo = await proxy.start();
      expect(bindInfo.address).toBe('127.0.0.1');
      expect(bindInfo.port).toBeGreaterThan(0);
    } finally {
      await proxy.stop();
    }
  });
  it('keeps sequence ordering stable across overflow', () => {
    const counter = new SequenceCounter(1);
    const a = counter.next();
    const b = counter.next();
    const c = counter.next();
    expect(a).toEqual({ epoch: 0n, value: 0 });
    expect(b).toEqual({ epoch: 0n, value: 1 });
    expect(c).toEqual({ epoch: 1n, value: 0 });
  });
  it('logs a warning for unstable network profiles', () => {
    const warnings: string[] = [];
    const logger = {
      log: () => {},
      warn: (...args: unknown[]) => warnings.push(String(args[0])),
      error: () => {},
    };
    logWarningIfNetworkProfileUnstable(UnrealLagProfiles.MarsLink, logger);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('may be unstable');

    const noWarnings: string[] = [];
    const quietLogger = {
      log: () => {},
      warn: (...args: unknown[]) => noWarnings.push(String(args[0])),
      error: () => {},
    };
    logWarningIfNetworkProfileUnstable(UnrealLagProfiles.Good, quietLogger);
    expect(noWarnings.length).toBe(0);
  });
  it('passes a small datagram through unchanged', async () => {
    const { socket: serverSocket, info: serverInfo } = await createEchoServer();
    const proxy = new UnrealLag({
      bindAddress: '127.0.0.1',
      bindPort: 0,
      server: { address: serverInfo.address, port: serverInfo.port, selection: { profile: 'NoLag' } },
      defaultClient: { profile: 'NoLag' },
      randomSeed: 1234,
    });
    const clientSocket = dgram.createSocket('udp4');
    try {
      const bindInfo = await proxy.start();
      await bindSocket(clientSocket, 0);
      const payload = Buffer.from('hello-unreal-lag');
      clientSocket.send(payload, bindInfo.port, bindInfo.address);
      const received = await waitForMessage(clientSocket, 1000);
      expect(received.msg.toString()).toBe(payload.toString());
    } finally {
      await closeSocket(clientSocket);
      await proxy.stop();
      await closeSocket(serverSocket);
    }
  });
  it('passes a large datagram through unchanged', async () => {
    const { socket: serverSocket, info: serverInfo } = await createEchoServer();
    const proxy = new UnrealLag({
      bindAddress: '127.0.0.1',
      bindPort: 0,
      server: { address: serverInfo.address, port: serverInfo.port, selection: { profile: 'NoLag' } },
      defaultClient: { profile: 'NoLag' },
      randomSeed: 1234,
    });
    const clientSocket = dgram.createSocket('udp4');
    try {
      const bindInfo = await proxy.start();
      await bindSocket(clientSocket, 0);
      const payload = Buffer.alloc(8 * 1024, 0x5a);
      payload.write('large-packet-smoke', 0, 'utf8');
      clientSocket.send(payload, bindInfo.port, bindInfo.address);
      const received = await waitForMessage(clientSocket, 1000);
      expect(received.msg).toEqual(payload);
    } finally {
      await closeSocket(clientSocket);
      await proxy.stop();
      await closeSocket(serverSocket);
    }
  });
  it('drops in-transit packets when an auto-created peer is removed', async () => {
    const { socket: serverSocket, info: serverInfo } = await createEchoServer();
    const proxy = new UnrealLag({
      bindAddress: '127.0.0.1',
      bindPort: 0,
      server: { address: serverInfo.address, port: serverInfo.port, selection: { profile: 'NoLag' } },
      defaultClient: {
        inbound: { latencyMs: 0 },
        outbound: { latencyMs: 150 },
      },
      randomSeed: 1234,
    });
    const clientSocket = dgram.createSocket('udp4');
    try {
      const bindInfo = await proxy.start();
      await bindSocket(clientSocket, 0);
      const autoCreated = new Promise<{ id: string }>((resolve) => {
        proxy.once('clientAutoCreated', (peer) => resolve(peer as { id: string }));
      });
      clientSocket.send(Buffer.from('drop-me'), bindInfo.port, bindInfo.address);
      const peer = await autoCreated;
      await proxy.removePeer(peer.id);
      await expect(waitForMessage(clientSocket, 400)).rejects.toThrow(/Timed out waiting for UDP message/);
    } finally {
      await closeSocket(clientSocket);
      await proxy.stop();
      await closeSocket(serverSocket);
    }
  });
});
