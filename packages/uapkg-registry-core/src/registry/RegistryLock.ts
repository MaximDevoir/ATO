import { readFile, unlink, writeFile } from 'node:fs/promises';
import type { UnixTimestamp } from '@uapkg/common-schema';
import {
  createIoErrorDiagnostic,
  createLockAcquisitionFailedDiagnostic,
  DiagnosticBag,
  fail,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import type { RegistryLockData } from '../contracts/RegistryCoreTypes.js';

const HEARTBEAT_STALE_SECONDS = 30;
const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * File-based lock for registry updates.
 *
 * - Acquire via exclusive create (`wx`).
 * - Maintain heartbeat while owning.
 * - Detect stale from heartbeat timeout.
 * - Never delete another process's valid lock.
 */
export class RegistryLock {
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly lockPath: string) {}

  /** Try to acquire the lock. Returns ok(true) if acquired. */
  async acquire(): Promise<Result<boolean>> {
    const bag = new DiagnosticBag();
    const data: RegistryLockData = {
      pid: process.pid,
      startedAt: nowTimestamp(),
      heartbeat: nowTimestamp(),
    };

    try {
      const { writeFile: wf } = await import('node:fs/promises');
      const { openSync, closeSync } = await import('node:fs');
      // Attempt atomic exclusive create
      const fd = openSync(this.lockPath, 'wx');
      closeSync(fd);
      await wf(this.lockPath, JSON.stringify(data), 'utf-8');
      this.startHeartbeat();
      return ok(true);
    } catch {
      // Lock file exists — check if stale
      const staleResult = await this.isStale();
      if (!staleResult.ok) {
        bag.mergeArray(staleResult.diagnostics);
        return bag.toFailure();
      }

      if (staleResult.value) {
        // Stale lock — take over
        await this.forceWrite(data);
        this.startHeartbeat();
        return ok(true);
      }

      // Lock is held by another active process
      const existing = await this.readLock();
      const ownerPid = existing.ok ? existing.value.pid : -1;
      bag.add(createLockAcquisitionFailedDiagnostic(this.lockPath, ownerPid));
      return bag.toFailure();
    }
  }

  /** Release the lock owned by this process. */
  async release(): Promise<Result<void>> {
    this.stopHeartbeat();
    try {
      await unlink(this.lockPath);
      return ok(undefined);
    } catch (err) {
      return fail([createIoErrorDiagnostic(this.lockPath, String(err))]);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      void this.updateHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    // Allow process to exit even if timer is running
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async updateHeartbeat(): Promise<void> {
    try {
      const raw = await readFile(this.lockPath, 'utf-8');
      const data = JSON.parse(raw) as RegistryLockData;
      if (data.pid !== process.pid) return; // not our lock
      const updated: RegistryLockData = { ...data, heartbeat: nowTimestamp() };
      await writeFile(this.lockPath, JSON.stringify(updated), 'utf-8');
    } catch {
      // Best effort
    }
  }

  private async isStale(): Promise<Result<boolean>> {
    const lockResult = await this.readLock();
    if (!lockResult.ok) {
      // Can't read → treat as stale
      return ok(true);
    }
    const data = lockResult.value;
    const elapsed = nowTimestamp() - data.heartbeat;
    return ok(elapsed > HEARTBEAT_STALE_SECONDS);
  }

  private async readLock(): Promise<Result<RegistryLockData>> {
    try {
      const raw = await readFile(this.lockPath, 'utf-8');
      return ok(JSON.parse(raw) as RegistryLockData);
    } catch (err) {
      return fail([createIoErrorDiagnostic(this.lockPath, String(err))]);
    }
  }

  private async forceWrite(data: RegistryLockData): Promise<void> {
    await writeFile(this.lockPath, JSON.stringify(data), 'utf-8');
  }
}

function nowTimestamp(): UnixTimestamp {
  return Math.floor(Date.now() / 1000) as UnixTimestamp;
}
