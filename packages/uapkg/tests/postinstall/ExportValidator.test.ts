import { describe, expect, it } from 'vitest';
import { ExportValidator } from '../../src/postinstall/loader/ExportValidator.js';

const v = new ExportValidator();

describe('ExportValidator', () => {
  it('accepts valid default export', () => {
    const mod = { default: { setupModules: { classBody: 'x' } } };
    const result = v.validate('pkg', '/p/x.ts', mod);
    expect(result.ok).toBe(true);
  });

  it('accepts bare exported object (no default)', () => {
    const result = v.validate('pkg', '/p/x.ts', { setupProject: { plugins: ['A'] } });
    expect(result.ok).toBe(true);
  });

  it('rejects non-object export', () => {
    const result = v.validate('pkg', '/p/x.ts', 'oops');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].code).toBe('POSTINSTALL_INVALID_EXPORT');
    }
  });

  it('rejects unknown keys (strict schema)', () => {
    const result = v.validate('pkg', '/p/x.ts', { default: { totallyUnknown: 1 } });
    expect(result.ok).toBe(false);
  });

  it('rejects empty string in zone content', () => {
    const result = v.validate('pkg', '/p/x.ts', { default: { setupModules: { classBody: '' } } });
    expect(result.ok).toBe(false);
  });
});
