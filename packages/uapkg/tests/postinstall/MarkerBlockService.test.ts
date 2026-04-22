import { describe, expect, it } from 'vitest';
import { MarkerBlockService } from '../../src/postinstall/markers/MarkerBlockService.js';

const svc = new MarkerBlockService();
const PLUGIN = 'plug';
const ZONE = 'zone';

describe('MarkerBlockService', () => {
  it('createBlock emits BEGIN/END with content', () => {
    const block = svc.createBlock(PLUGIN, ZONE, 'line1\nline2');
    expect(block).toContain(`UAPKG-BEGIN ${PLUGIN}:${ZONE}`);
    expect(block).toContain(`UAPKG-END ${PLUGIN}:${ZONE}`);
    expect(block).toContain('line1');
    expect(block).toContain('line2');
  });

  it('createBlock honors indent', () => {
    const block = svc.createBlock(PLUGIN, ZONE, 'line1', '  ');
    expect(block.split('\n')[0]).toMatch(/^ {2}\/\/ UAPKG-BEGIN /);
  });

  it('stripOwnedBlock removes the owned block only', () => {
    const src = `A\n${svc.createBlock(PLUGIN, ZONE, 'body')}\nB\n`;
    const stripped = svc.stripOwnedBlock(src, PLUGIN, ZONE);
    expect(stripped).toContain('A');
    expect(stripped).toContain('B');
    expect(stripped).not.toContain('UAPKG-BEGIN');
  });

  it('stripOwnedBlock leaves foreign owned blocks intact', () => {
    const ours = svc.createBlock(PLUGIN, ZONE, 'ours');
    const theirs = svc.createBlock('other', ZONE, 'theirs');
    const stripped = svc.stripOwnedBlock(`${ours}\n${theirs}\n`, PLUGIN, ZONE);
    expect(stripped).toContain('other');
    expect(stripped).not.toContain(`${PLUGIN}:${ZONE}`);
  });

  it('containsOwnedBlock reports presence', () => {
    const src = svc.createBlock(PLUGIN, ZONE, 'x');
    expect(svc.containsOwnedBlock(src, PLUGIN, ZONE)).toBe(true);
    expect(svc.containsOwnedBlock('nothing', PLUGIN, ZONE)).toBe(false);
  });
});
