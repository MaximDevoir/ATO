import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PackService } from '../src/core/PackService';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-pack-'));
}

describe('PackService', () => {
  it('creates archive and integrity file', async () => {
    const root = createTempDir();
    fs.writeFileSync(path.join(root, 'uapkg.json'), '{"name":"pkg","version":"1.0.0"}\n', 'utf8');
    fs.writeFileSync(path.join(root, 'file.txt'), 'hello\n', 'utf8');

    const result = await new PackService().pack({ cwd: root });

    expect(fs.existsSync(result.archivePath)).toBe(true);
    expect(result.integrityPath).toBeDefined();
    expect(result.integrityPath ? fs.existsSync(result.integrityPath) : false).toBe(true);
    expect(result.files).toContain('uapkg.json');
    expect(result.files).toContain('file.txt');
  });

  it('supports dry-run without writing archive', async () => {
    const root = createTempDir();
    fs.writeFileSync(path.join(root, 'uapkg.json'), '{"name":"pkg","version":"1.0.0"}\n', 'utf8');
    fs.writeFileSync(path.join(root, 'file.txt'), 'hello\n', 'utf8');

    const outFile = 'custom.tgz';
    const result = await new PackService().pack({ cwd: root, dryRun: true, outFile });

    expect(result.dryRun).toBe(true);
    expect(fs.existsSync(path.join(root, outFile))).toBe(false);
  });
});
