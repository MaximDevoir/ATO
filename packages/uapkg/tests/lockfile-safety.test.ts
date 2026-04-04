import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOMLLockfileRepository } from '../src/lockfile/LockfileRepository';
import { SafetyPolicy } from '../src/safety/SafetyPolicy';

describe('TOMLLockfileRepository', () => {
  it('writes and reads uapkg.lock package entries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-lock-test-'));
    const repo = new TOMLLockfileRepository();
    repo.write(tempDir, {
      package: [
        {
          name: 'AwesomeInventory',
          version: 'main',
          hash: 'a1b2c3',
          source: 'https://github.com/org/AwesomeInventory.git',
          dependencies: ['CoreUtils'],
        },
      ],
    });

    const parsed = repo.read(tempDir);
    expect(parsed.package).toEqual([
      {
        name: 'AwesomeInventory',
        version: 'main',
        hash: 'a1b2c3',
        source: 'https://github.com/org/AwesomeInventory.git',
        dependencies: ['CoreUtils'],
      },
    ]);
  });

  it('persists harnessed package metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-lock-test-'));
    const repo = new TOMLLockfileRepository();
    repo.write(tempDir, {
      package: [
        {
          name: 'AwesomeInventory',
          version: 'main',
          hash: 'a1b2c3',
          source: 'https://github.com/org/AwesomeInventory.git',
          dependencies: ['CoreUtils'],
          harnessed: true,
        },
      ],
    });

    const parsed = repo.read(tempDir);
    expect(parsed.package[0]?.harnessed).toBe(true);
  });
});

describe('SafetyPolicy', () => {
  it('blocks dirty repositories without force', () => {
    const policy = new SafetyPolicy();
    const decision = policy.canUpdatePackage(
      {
        name: 'AwesomeInventory',
        source: 'https://github.com/org/AwesomeInventory.git',
        version: 'main',
        hash: 'abc123',
        dependencies: [],
      },
      {
        isRepository: true,
        isDirty: true,
        branch: 'main',
        commit: 'abc123',
      },
      false,
    );

    expect(decision.allowed).toBe(false);
  });

  it('allows force updates even with drift', () => {
    const policy = new SafetyPolicy();
    const decision = policy.canUpdatePackage(
      {
        name: 'AwesomeInventory',
        source: 'https://github.com/org/AwesomeInventory.git',
        version: 'main',
        hash: 'abc123',
        dependencies: [],
      },
      {
        isRepository: true,
        isDirty: true,
        branch: 'feature/my-work',
        commit: 'def456',
        remoteUrl: 'https://github.com/company/AwesomeInventory.git',
      },
      true,
    );

    expect(decision.allowed).toBe(true);
  });

  it('blocks non-lockfile branch repos without force', () => {
    const policy = new SafetyPolicy();
    const decision = policy.canUpdatePackage(
      undefined,
      {
        isRepository: true,
        isDirty: false,
        branch: 'feature/work',
        commit: 'def456',
      },
      false,
    );

    expect(decision.allowed).toBe(false);
  });
});
