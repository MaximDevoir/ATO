import fs from 'node:fs';
import path from 'node:path';
import type { GlobalUapkgSnapshot, SavedGlobalUapkgState } from './types';

export class GlobalUapkgSnapshotStore {
  private readonly snapshotPath: string;

  constructor(private readonly workspaceRoot: string) {
    this.snapshotPath = path.join(this.workspaceRoot, 'tools', 'dev-build', '.state', 'global-uapkg-state.json');
  }

  getSnapshotPath() {
    return this.snapshotPath;
  }

  exists() {
    return fs.existsSync(this.snapshotPath);
  }

  read(): GlobalUapkgSnapshot | null {
    if (!this.exists()) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.snapshotPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!this.isValidSnapshot(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  write(previous: SavedGlobalUapkgState) {
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });

    const payload: GlobalUapkgSnapshot = {
      createdAt: new Date().toISOString(),
      workspaceRoot: this.workspaceRoot,
      packageName: 'uapkg',
      previous,
    };

    fs.writeFileSync(this.snapshotPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  remove() {
    if (!this.exists()) {
      return;
    }

    fs.unlinkSync(this.snapshotPath);
  }

  private isValidSnapshot(parsed: unknown): parsed is GlobalUapkgSnapshot {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const snapshot = parsed as Record<string, unknown>;
    return snapshot.packageName === 'uapkg' && typeof snapshot.workspaceRoot === 'string';
  }
}
