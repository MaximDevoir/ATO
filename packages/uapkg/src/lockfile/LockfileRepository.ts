import fs from 'node:fs';
import * as path from 'node:path';
import * as toml from '@iarna/toml';
import type { LockedPackage, UAPKGLockfile } from './UAPKGLockfile';

export interface LockfileRepository {
  getPath(cwd: string): string;
  exists(cwd: string): boolean;
  read(cwd: string): UAPKGLockfile;
  write(cwd: string, lockfile: UAPKGLockfile): void;
}

export class TOMLLockfileRepository implements LockfileRepository {
  getPath(cwd: string) {
    return path.join(cwd, 'uapkg.lock');
  }

  exists(cwd: string) {
    return fs.existsSync(this.getPath(cwd));
  }

  read(cwd: string): UAPKGLockfile {
    const lockfilePath = this.getPath(cwd);
    const source = fs.readFileSync(lockfilePath, 'utf-8');
    try {
      const parsed = toml.parse(source) as { package?: unknown };
      const packages = Array.isArray(parsed.package) ? parsed.package : [];
      return {
        package: packages.map((entry) => normalizeLockedPackage(entry, lockfilePath)),
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'line' in error) {
        const parseWithPretty = (
          toml as unknown as { parse?: { prettyError?: (error: Error, source: string) => string } }
        ).parse;
        const pretty = parseWithPretty?.prettyError?.(
          error as Error & { line: number; column: number; message: string },
          source,
        );
        throw new Error(`[uapkg] Failed to parse ${lockfilePath}:\n${pretty}`);
      }
      throw new Error(
        `[uapkg] Failed to parse ${lockfilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  write(cwd: string, lockfile: UAPKGLockfile) {
    const sortedPackages = [...lockfile.package].sort((a, b) => a.name.localeCompare(b.name));
    const serialized = toml.stringify({
      package: sortedPackages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        hash: entry.hash,
        source: entry.source,
        dependencies: [...entry.dependencies].sort(),
        ...(entry.harnessed ? { harnessed: true } : {}),
      })),
    });
    fs.writeFileSync(this.getPath(cwd), serialized, 'utf-8');
  }
}

function normalizeLockedPackage(value: unknown, lockfilePath: string): LockedPackage {
  if (!value || typeof value !== 'object') {
    throw new Error(`[uapkg] Invalid package entry in ${lockfilePath}`);
  }

  const entry = value as Partial<LockedPackage>;
  if (!entry.name || !entry.source || !entry.version || !entry.hash) {
    throw new Error(`[uapkg] Lockfile package entry missing required keys in ${lockfilePath}`);
  }

  return {
    name: entry.name,
    source: entry.source,
    version: entry.version,
    hash: entry.hash,
    dependencies: Array.isArray(entry.dependencies)
      ? entry.dependencies.map((dependencyName) => String(dependencyName))
      : [],
    ...(entry.harnessed === true ? { harnessed: true } : {}),
  };
}
