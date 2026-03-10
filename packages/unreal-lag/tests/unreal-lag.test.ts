import * as dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  createExampleUnrealLag,
  hasPriorityMarker,
  joinWithPriorityMarker,
  prependPriorityMarker,
  resolvePeerSelection,
  SequenceCounter,
  UNREAL_LAG_PRIORITY_MARKER,
  UnrealLag,
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
async function waitForMessageOrTimeout(socket: dgram.Socket, timeoutMs: number) {
  try {
    return await waitForMessage(socket, timeoutMs);
  } catch {
    return undefined;
  }
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
    expect(resolved.inbound.lossPct).toBe(0.1);
    expect(resolved.inbound.latencyMs).toBe(30);
    expect(resolved.outbound.lossPct).toBe(0.1);
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
  it('detects priority markers in prefix, middle, and suffix positions', () => {
    const prefixPayload = prependPriorityMarker(Buffer.from('prefix-case'));
    const middlePayload = joinWithPriorityMarker('before-middle-', '-after-middle');
    const suffixPayload = joinWithPriorityMarker('before-suffix-');
    const nearMissPayload = Buffer.from(middlePayload);
    const markerIndex = nearMissPayload.indexOf(UNREAL_LAG_PRIORITY_MARKER);
    nearMissPayload[markerIndex + UNREAL_LAG_PRIORITY_MARKER.length - 1] ^= 0x01;
    expect(hasPriorityMarker(prefixPayload)).toBe(true);
    expect(hasPriorityMarker(middlePayload)).toBe(true);
    expect(hasPriorityMarker(suffixPayload)).toBe(true);
    expect(hasPriorityMarker(Buffer.from('no-marker-here'))).toBe(false);
    expect(hasPriorityMarker(nearMissPayload)).toBe(false);
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
  it('bypasses forced packet loss for priority packets', async () => {
    const { socket: serverSocket, info: serverInfo } = await createEchoServer();
    const proxy = new UnrealLag({
      bindAddress: '127.0.0.1',
      bindPort: 0,
      server: {
        address: serverInfo.address,
        port: serverInfo.port,
        selection: {
          inbound: { lossPct: 100 },
          outbound: { lossPct: 100 },
        },
      },
      defaultClient: {
        inbound: { lossPct: 100 },
        outbound: { lossPct: 100 },
      },
      randomSeed: 1234,
    });
    const clientSocket = dgram.createSocket('udp4');
    try {
      const bindInfo = await proxy.start();
      await bindSocket(clientSocket, 0);
      clientSocket.send(Buffer.from('normal-drop-check'), bindInfo.port, bindInfo.address);
      const normalResponse = await waitForMessageOrTimeout(clientSocket, 500);
      expect(normalResponse).toBeUndefined();
      const priorityPayload = joinWithPriorityMarker('drop-bypass-start-', '-drop-bypass-end');
      clientSocket.send(priorityPayload, bindInfo.port, bindInfo.address);
      const priorityResponse = await waitForMessage(clientSocket, 1000);
      expect(priorityResponse.msg).toEqual(priorityPayload);
    } finally {
      await closeSocket(clientSocket);
      await proxy.stop();
      await closeSocket(serverSocket);
    }
  });
  it('bypasses long configured latency for priority packets', async () => {
    const { socket: serverSocket, info: serverInfo } = await createEchoServer();
    const twoSeconds = 2000;
    const proxy = new UnrealLag({
      bindAddress: '127.0.0.1',
      bindPort: 0,
      server: {
        address: serverInfo.address,
        port: serverInfo.port,
        selection: {
          inbound: { latencyMinMs: twoSeconds, latencyMaxMs: twoSeconds },
          outbound: { latencyMinMs: twoSeconds, latencyMaxMs: twoSeconds },
        },
      },
      defaultClient: {
        inbound: { latencyMinMs: twoSeconds, latencyMaxMs: twoSeconds },
        outbound: { latencyMinMs: twoSeconds, latencyMaxMs: twoSeconds },
      },
      randomSeed: 1234,
    });
    const clientSocket = dgram.createSocket('udp4');
    try {
      const bindInfo = await proxy.start();
      await bindSocket(clientSocket, 0);
      clientSocket.send(Buffer.from('normal-latency-check'), bindInfo.port, bindInfo.address);
      const normalResponse = await waitForMessageOrTimeout(clientSocket, 1000);
      expect(normalResponse).toBeUndefined();
      const priorityPayload = joinWithPriorityMarker('latency-bypass-start-', '-latency-bypass-end');
      const startedAt = Date.now();
      clientSocket.send(priorityPayload, bindInfo.port, bindInfo.address);
      const priorityResponse = await waitForMessage(clientSocket, 1000);
      const elapsedMs = Date.now() - startedAt;
      expect(priorityResponse.msg).toEqual(priorityPayload);
      expect(elapsedMs).toBeLessThan(1000);
    } finally {
      await closeSocket(clientSocket);
      await proxy.stop();
      await closeSocket(serverSocket);
    }
  });
});
