import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntryResolver } from '../../src/postinstall/loader/EntryResolver.js';

let tmp = '';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-entry-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, content = 'x') {
  const abs = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

describe('EntryResolver', () => {
  const r = new EntryResolver();

  it('returns null when no .uapkg directory exists', () => {
    const result = r.resolve('pkg', tmp);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('returns null when .uapkg exists but has no entry', () => {
    fs.mkdirSync(path.join(tmp, '.uapkg'));
    const result = r.resolve('pkg', tmp);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('finds a .ts entry', () => {
    write('.uapkg/postinstall.ts');
    const result = r.resolve('pkg', tmp);
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.kind).toBe('ts');
      expect(path.basename(result.value.path)).toBe('postinstall.ts');
    }
  });

  it('finds .mjs when only .mjs exists', () => {
    write('.uapkg/postinstall.mjs');
    const result = r.resolve('pkg', tmp);
    if (result.ok && result.value) expect(result.value.kind).toBe('mjs');
  });

  it('fails POSTINSTALL_DUPLICATE_ENTRY when multiple entries exist', () => {
    write('.uapkg/postinstall.ts');
    write('.uapkg/postinstall.js');
    const result = r.resolve('pkg', tmp);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].code).toBe('POSTINSTALL_DUPLICATE_ENTRY');
    }
  });
});
