import { unlink } from 'node:fs/promises';
import type { ConfigInstance } from '@uapkg/config';
import { DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { Lockfile } from '@uapkg/package-manifest-schema';
import type { RegistryCore } from '@uapkg/registry-core';
import pLimit from 'p-limit';
import type { InstallAction, InstallerOptions, InstallPlan } from '../contracts/InstallerTypes.js';
import type { DownloadStatusSnapshot } from '../contracts/StatusStreamTypes.js';
import { NoMarkerPolicy } from '../safety/NoMarkerPolicy.js';
import { SafetyPolicyRegistry } from '../safety/SafetyPolicyRegistry.js';
import { SlotTable } from '../status/SlotTable.js';
import { StatusStream } from '../status/StatusStream.js';
import { DiskStateInspector } from './DiskStateInspector.js';
import { InstallPlanner } from './InstallPlanner.js';
import { IntegrityVerifier } from './IntegrityVerifier.js';
import { PackageDownloader } from './PackageDownloader.js';
import { PackageExtractor } from './PackageExtractor.js';
import { PackageRemover } from './PackageRemover.js';

interface ExecutionRuntime {
  readonly slots: SlotTable;
  readonly stream: StatusStream;
}

export interface InstallerConstructorOptions {
  readonly registryCore: RegistryCore;
  readonly config: InstanceType<typeof ConfigInstance>;
}

/**
 * Physical installation orchestrator. Owns the collaborators but is not a
 * god-class — each step delegates to a single-responsibility module.
 *
 * Public surface:
 *   - execute(lockfile, previous?) → Result<InstallPlan>
 *   - getStatusStream() → AsyncIterable<DownloadStatusSnapshot>
 *
 * Concurrency is read from `network.maxConcurrentDownloads` in config;
 * retries/timeout from `network.retries` / `network.timeout`.
 *
 * Emits no console output. Progress flows through the status stream.
 */
export class Installer {
  private readonly inspector = new DiskStateInspector();
  private readonly planner: InstallPlanner;
  private readonly downloader = new PackageDownloader();
  private readonly verifier = new IntegrityVerifier();
  private readonly extractor = new PackageExtractor();
  private readonly remover = new PackageRemover();
  private readonly safety = new SafetyPolicyRegistry();

  private slots: SlotTable | null = null;
  private stream: StatusStream | null = null;

  constructor(private readonly deps: InstallerConstructorOptions) {
    this.planner = new InstallPlanner(deps.registryCore);
    this.safety.register(new NoMarkerPolicy());
  }

  /** Expose the registry so consumers can register additional policies. */
  get safetyRegistry(): SafetyPolicyRegistry {
    return this.safety;
  }

  getStatusStream(): AsyncIterable<DownloadStatusSnapshot> {
    if (!this.stream) {
      // Lazy creation — if execute() hasn't been called yet, use a single slot
      // so the stream is still iterable (yields empty snapshots).
      this.slots = new SlotTable(this.readMaxConcurrent());
      this.stream = new StatusStream(this.slots);
    }
    return this.stream;
  }

  async execute(
    lockfile: Lockfile,
    previousLockfile: Lockfile | null,
    options: InstallerOptions,
  ): Promise<Result<InstallPlan>> {
    const bag = new DiagnosticBag();
    const maxConcurrent = this.readMaxConcurrent();
    const runtime = this.createExecutionRuntime(maxConcurrent);

    // 1. Inspect disk
    const diskResult = await this.inspector.inspect(options.manifestRoot, lockfile);
    if (!diskResult.ok) return diskResult as Result<never>;

    // 2. Plan
    const planResult = await this.planner.plan(lockfile, previousLockfile, diskResult.value);
    if (!planResult.ok) return planResult as Result<never>;
    const plan = planResult.value;

    // Seed totals into SlotTable
    runtime.slots.setTotals({
      added: plan.summary.added,
      updated: plan.summary.updated,
      removed: plan.summary.removed,
      unchanged: plan.summary.unchanged,
      bytesDone: 0,
      bytesTotal: plan.summary.totalBytes,
    });
    runtime.stream.publish();

    // 3. Safety gate
    const verdictsResult = await this.safety.evaluatePlan(options.manifestRoot, plan.actions, options.force ?? false);
    if (!verdictsResult.ok) {
      bag.mergeArray(verdictsResult.diagnostics);
      runtime.stream.close();
      return bag.toFailure();
    }

    if (options.dryRun) {
      runtime.stream.close();
      return ok(plan);
    }

    // 4. Execute actions under concurrency limit
    const limit = pLimit(maxConcurrent);
    const retries = this.readNumber('network.retries', 2);
    const timeoutSeconds = this.readNumber('network.timeout', 300);
    const timeoutMs = timeoutSeconds * 1000;

    await Promise.all(
      verdictsResult.value
        .filter((v) => !v.blocked)
        .map((v) =>
          limit(async () => {
            const res = await this.executeAction(options.manifestRoot, v.action, { retries, timeoutMs }, runtime);
            if (!res.ok) bag.mergeArray(res.diagnostics);
          }),
        ),
    );

    runtime.stream.close();
    if (bag.hasErrors()) return bag.toFailure();
    return ok(plan);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private async executeAction(
    manifestRoot: string,
    action: InstallAction,
    net: { readonly retries: number; readonly timeoutMs: number },
    runtime: ExecutionRuntime,
  ): Promise<Result<void>> {
    const { slots, stream } = runtime;

    if (action.type === 'unchanged') return ok(undefined);

    const slotId =
      slots.claim({
        state: action.type === 'remove' ? 'removing' : 'downloading',
        packageName: action.packageName,
        version: action.targetVersion,
        bytesDone: 0,
        bytesTotal: action.sizeBytes,
        attempt: 1,
      }) ?? 0;
    stream.publish();

    try {
      if (action.type === 'remove') {
        const r = await this.remover.remove(action.packageName, manifestRoot, action.path);
        slots.update(slotId, { state: r.ok ? 'done' : 'failed' });
        stream.publish();
        slots.release(slotId);
        return r;
      }

      if (!action.downloadUrl || !action.integrity) {
        slots.update(slotId, { state: 'failed' });
        stream.publish();
        slots.release(slotId);
        return ok(undefined);
      }

      // Download
      const dl = await this.downloader.download(
        action.packageName,
        action.downloadUrl,
        { retries: net.retries, timeoutMs: net.timeoutMs },
        (bytesDone, bytesTotal, attempt) => {
          slots.update(slotId, { bytesDone, bytesTotal, attempt });
          stream.publish();
        },
      );
      if (!dl.ok) {
        slots.update(slotId, { state: 'failed' });
        stream.publish();
        slots.release(slotId);
        return dl as Result<never>;
      }

      // Verify
      slots.update(slotId, { state: 'verifying' });
      stream.publish();
      const verify = await this.verifier.verify(action.packageName, dl.value.tempPath, action.integrity);
      if (!verify.ok) {
        await this.safeUnlink(dl.value.tempPath);
        slots.update(slotId, { state: 'failed' });
        stream.publish();
        slots.release(slotId);
        return verify as Result<never>;
      }

      // Extract
      slots.update(slotId, { state: 'extracting' });
      stream.publish();
      const ex = await this.extractor.extract(action.packageName, dl.value.tempPath, manifestRoot, action.path);
      await this.safeUnlink(dl.value.tempPath);
      if (!ex.ok) {
        slots.update(slotId, { state: 'failed' });
        stream.publish();
        slots.release(slotId);
        return ex as Result<never>;
      }

      if (action.sizeBytes) slots.addBytesDone(action.sizeBytes);
      slots.update(slotId, { state: 'done' });
      stream.publish();
      slots.release(slotId);
      return ok(undefined);
    } catch (_err) {
      slots.update(slotId, { state: 'failed' });
      stream.publish();
      slots.release(slotId);
      return ok(undefined); // never throw — diagnostics already captured inside collaborators
    }
  }

  private readMaxConcurrent(): number {
    const raw = this.deps.config.get('network.maxConcurrentDownloads');
    return typeof raw === 'number' && raw >= 1 ? Math.floor(raw) : 5;
  }

  private createExecutionRuntime(maxConcurrent: number): ExecutionRuntime {
    const slots = new SlotTable(maxConcurrent);
    const stream = new StatusStream(slots);
    this.slots = slots;
    this.stream = stream;
    return { slots, stream };
  }

  private readNumber(key: string, fallback: number): number {
    const raw = this.deps.config.get(key);
    return typeof raw === 'number' ? raw : fallback;
  }

  private async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      /* best-effort */
    }
  }
}
