import { spawn } from 'node:child_process';

const unrealLogPrefixPattern = /^\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})(?::\d+)?]\[\s*\d+](.*)$/;
export interface SpawnProcessOptions {
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  emitLine?: (line: string, stream: 'stdout' | 'stderr') => void;
}
function formatTwelveHourTime(hours24: number, minutes: number, seconds: number) {
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hours12}:${mm}:${ss} ${suffix}`;
}
export function simplifyUnrealLogLine(line: string) {
  const match = unrealLogPrefixPattern.exec(line);
  if (!match) return line;
  const hours24 = Number.parseInt(match[4], 10);
  const minutes = Number.parseInt(match[5], 10);
  const seconds = Number.parseInt(match[6], 10);
  const rest = match[7] ?? '';
  if ([hours24, minutes, seconds].some(Number.isNaN)) {
    return line;
  }
  return `[${formatTwelveHourTime(hours24, minutes, seconds)}] ${rest}`;
}
export function prefixStream(
  prefix: string,
  stream: NodeJS.ReadableStream | null,
  onLine?: (line: string) => void,
  emitLine?: (line: string, stream: 'stdout' | 'stderr') => void,
  streamKind: 'stdout' | 'stderr' = 'stdout',
) {
  if (!stream) return;
  let buf = '';
  stream.on('data', (chunk: Buffer | string) => {
    buf += chunk.toString();
    while (true) {
      const idx = buf.indexOf('\n');
      if (idx < 0) {
        break;
      }
      const line = simplifyUnrealLogLine(buf.slice(0, idx).replace(/\r$/, ''));
      onLine?.(line);
      emitLine?.(`[${prefix}] ${line}`, streamKind);
      buf = buf.slice(idx + 1);
    }
  });
  stream.on('end', () => {
    if (buf.length) {
      const line = simplifyUnrealLogLine(buf.replace(/\r$/, ''));
      onLine?.(line);
      emitLine?.(`[${prefix}] ${line}`, streamKind);
      buf = '';
    }
  });
}
async function isUdpPortBoundViaGetNetUDPEndpoint(pid: number, port: number) {
  try {
    const cmd = `try { $e = Get-NetUDPEndpoint -OwningProcess ${pid} -ErrorAction SilentlyContinue; if ($e -and $e.LocalPort -eq ${port}) { Write-Output 'BOUND' } } catch { }`;
    const check = spawn('powershell', ['-NoProfile', '-Command', cmd], { windowsHide: true });
    let out = '';
    if (check.stdout) {
      for await (const chunk of check.stdout) {
        out += chunk.toString();
      }
    }
    await new Promise<void>((res) => check.on('close', () => res()));
    return out.trim().length > 0;
  } catch {
    return false;
  }
}
async function isUdpPortBoundViaNetstat(pid: number, port: number) {
  try {
    const net = spawn('netstat', ['-ano', '-p', 'udp'], { windowsHide: true });
    let out = '';
    if (net.stdout) {
      for await (const chunk of net.stdout) {
        out += chunk.toString();
      }
    }
    await new Promise<void>((res) => net.on('close', () => res()));
    const lines = out.split(/\r?\n/);
    for (const line of lines) {
      if (!line.includes(`:${port}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pidStr = parts.at(-1);
      const num = Number.parseInt(pidStr ?? '', 10);
      if (num === pid) return true;
    }
    return false;
  } catch {
    return false;
  }
}
export async function waitForUdpPort(pid: number, port: number, timeoutSeconds: number): Promise<void> {
  const start = Date.now();
  while (true) {
    if (await isUdpPortBoundViaGetNetUDPEndpoint(pid, port)) return;
    if (await isUdpPortBoundViaNetstat(pid, port)) return;
    if ((Date.now() - start) / 1000 > timeoutSeconds) {
      throw new Error(`Timeout waiting for UDP port ${port} from PID ${pid}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
export function spawnProcess(exe: string, args: string[], prefix: string, options: SpawnProcessOptions = {}) {
  const p = spawn(exe, args, { windowsHide: true, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
  prefixStream(prefix, p.stdout, options.onStdoutLine, options.emitLine, 'stdout');
  prefixStream(`${prefix}-ERR`, p.stderr, options.onStderrLine, options.emitLine, 'stderr');
  return p;
}
