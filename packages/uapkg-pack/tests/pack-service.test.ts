import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PackService } from '../src/core/PackService';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-pack-'));
}

function writeBasicPluginFixture(root: string) {
  fs.writeFileSync(path.join(root, 'uapkg.json'), '{"name":"pkg","version":"1.0.0"}\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'Plugin.uplugin'),
    '{"FileVersion":3,"Version":1,"FriendlyName":"Plugin"}\n',
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'file.txt'), 'hello\n', 'utf8');
}

describe('PackService', () => {
  it('creates archive and integrity file', async () => {
    const root = createTempDir();
    writeBasicPluginFixture(root);

    const result = await new PackService().pack({ cwd: root });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fs.existsSync(result.value.archivePath)).toBe(true);
    expect(result.value.integrityPath).toBeDefined();
    expect(result.value.integrityPath ? fs.existsSync(result.value.integrityPath) : false).toBe(true);
    expect(result.value.files).toContain('uapkg.json');
    expect(result.value.files).toContain('file.txt');
  });

  it('supports dry-run without writing archive', async () => {
    const root = createTempDir();
    writeBasicPluginFixture(root);

    const outFile = 'custom.tgz';
    const result = await new PackService().pack({ cwd: root, dryRun: true, outFile });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dryRun).toBe(true);
    expect(fs.existsSync(path.join(root, outFile))).toBe(false);
  });
});
