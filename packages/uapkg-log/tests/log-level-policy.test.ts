import { describe, expect, it, vi } from 'vitest';
import { LogLevelPolicy } from '../src/core/LogLevelPolicy';

describe('LogLevelPolicy', () => {
  it('prioritizes verbose over quiet', () => {
    const policy = new LogLevelPolicy();
    const level = policy.resolveLevel({ verbose: true, quiet: true });
    expect(level).toBe('debug');
  });

  it('falls back to info by default', () => {
    const policy = new LogLevelPolicy();
    const level = policy.resolveLevel({ verbose: false, quiet: false });
    expect(level).toBe('info');
  });

  it('uses resolver values when explicit options are absent', () => {
    const policy = new LogLevelPolicy();
    const resolver = {
      isVerboseEnabled: vi.fn(() => false),
      isQuietEnabled: vi.fn(() => true),
    };

    const level = policy.resolveEffectiveLevel({ resolver });

    expect(level).toBe('error');
    expect(resolver.isVerboseEnabled).toHaveBeenCalledOnce();
    expect(resolver.isQuietEnabled).toHaveBeenCalledOnce();
  });
});
