import { describe, expect, it } from 'vitest';
import { MarkerIntegrityValidator } from '../../src/postinstall/markers/MarkerIntegrityValidator.js';

const v = new MarkerIntegrityValidator();
const PLUGIN = 'plug';
const ZONE = 'module-class-body';

function block(body = 'x'): string {
  return [`// UAPKG-BEGIN ${PLUGIN}:${ZONE}`, body, `// UAPKG-END ${PLUGIN}:${ZONE}`].join('\n');
}

describe('MarkerIntegrityValidator', () => {
  it('ok for empty source', () => {
    expect(v.validate('', PLUGIN, ZONE).ok).toBe(true);
  });

  it('ok for well-formed block', () => {
    expect(v.validate(`header\n${block()}\nfooter\n`, PLUGIN, ZONE).ok).toBe(true);
  });

  it('ok when source has no markers', () => {
    expect(v.validate('nothing to see here\n', PLUGIN, ZONE).ok).toBe(true);
  });

  it('detects orphaned BEGIN', () => {
    const src = `x\n// UAPKG-BEGIN ${PLUGIN}:${ZONE}\nbody\n`;
    const r = v.validate(src, PLUGIN, ZONE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/orphaned BEGIN/);
  });

  it('detects orphaned END', () => {
    const src = `x\n// UAPKG-END ${PLUGIN}:${ZONE}\n`;
    const r = v.validate(src, PLUGIN, ZONE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/orphaned END/);
  });

  it('detects nested BEGIN', () => {
    const src = [
      `// UAPKG-BEGIN ${PLUGIN}:${ZONE}`,
      'body1',
      `// UAPKG-BEGIN ${PLUGIN}:${ZONE}`,
      'body2',
      `// UAPKG-END ${PLUGIN}:${ZONE}`,
      `// UAPKG-END ${PLUGIN}:${ZONE}`,
    ].join('\n');
    const r = v.validate(src, PLUGIN, ZONE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/nested BEGIN/);
  });

  it('ignores foreign plugin markers', () => {
    const src = [`// UAPKG-BEGIN other:${ZONE}`, 'foreign body', `// UAPKG-END other:${ZONE}`, block()].join('\n');
    expect(v.validate(src, PLUGIN, ZONE).ok).toBe(true);
  });

  it('ignores same plugin, different zone markers', () => {
    const src = [
      `// UAPKG-BEGIN ${PLUGIN}:other-zone`,
      'x',
      // missing END of other-zone — but that's not our zone
      block(),
    ].join('\n');
    expect(v.validate(src, PLUGIN, ZONE).ok).toBe(true);
  });

  it('ok with multiple sequential blocks for same pair', () => {
    const src = `${block('a')}\n${block('b')}`;
    expect(v.validate(src, PLUGIN, ZONE).ok).toBe(true);
  });
});
