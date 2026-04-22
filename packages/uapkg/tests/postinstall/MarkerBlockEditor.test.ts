import { describe, expect, it } from 'vitest';
import { MarkerBlockEditor } from '../../src/postinstall/markers/MarkerBlockEditor.js';

const PLUGIN = 'plug';
const ZONE = 'module-class-body';

describe('MarkerBlockEditor', () => {
  const editor = new MarkerBlockEditor();

  it('upsert is idempotent', () => {
    const once = editor.upsert('', PLUGIN, ZONE, 'content');
    const twice = editor.upsert(once, PLUGIN, ZONE, 'content');
    expect(twice).toBe(once);
  });

  it('remove is a no-op when no owned block exists', () => {
    expect(editor.remove('hello world', PLUGIN, ZONE)).toBe('hello world');
  });

  it('remove strips an owned block', () => {
    const withBlock = editor.upsert('before\n', PLUGIN, ZONE, 'content');
    const stripped = editor.remove(withBlock, PLUGIN, ZONE);
    expect(stripped).not.toContain('UAPKG-BEGIN');
    expect(stripped).not.toContain('UAPKG-END');
  });

  it('contains reports presence correctly', () => {
    const withBlock = editor.upsert('', PLUGIN, ZONE, 'content');
    expect(editor.contains(withBlock, PLUGIN, ZONE)).toBe(true);
    expect(editor.contains('nothing', PLUGIN, ZONE)).toBe(false);
  });

  it('validate returns ok for a clean block', () => {
    const withBlock = editor.upsert('', PLUGIN, ZONE, 'content');
    const result = editor.validate(withBlock, PLUGIN, ZONE, '/fake/path.cs');
    expect(result.ok).toBe(true);
  });

  it('validate returns POSTINSTALL_MARKER_CORRUPT for orphaned BEGIN', () => {
    const src = `// UAPKG-BEGIN ${PLUGIN}:${ZONE}\nbody\n`;
    const result = editor.validate(src, PLUGIN, ZONE, '/fake/path.cs');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toHaveLength(1);
      const diag = result.diagnostics[0];
      expect(diag.code).toBe('POSTINSTALL_MARKER_CORRUPT');
      expect(diag.level).toBe('error');
      // data is on the specific diagnostic subtype
      const data = (diag as { data: { packageName: string; file: string; reason: string } }).data;
      expect(data.packageName).toBe(PLUGIN);
      expect(data.file).toBe('/fake/path.cs');
      expect(data.reason).toMatch(/orphaned BEGIN/);
    }
  });
});
