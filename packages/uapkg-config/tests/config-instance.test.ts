import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createConfig } from '../src';

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-config-test-'));
}

describe('createConfig', () => {
  it('resolves merged values from default -> intermediary -> local', () => {
    const root = createTempRoot();
    const project = path.join(root, 'Project');
    const plugin = path.join(project, 'Plugins', 'MyPlugin');

    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(project, 'uapkg.json'),
      '{"name":"Project","type":"project","dependencies":[]}\n',
      'utf8',
    );

    fs.mkdirSync(path.join(project, '.uapkg'), { recursive: true });
    fs.writeFileSync(
      path.join(project, '.uapkg', 'config.json'),
      JSON.stringify({
        term: { quiet: true },
      }),
      'utf8',
    );

    fs.mkdirSync(path.join(plugin, '.uapkg'), { recursive: true });
    fs.writeFileSync(
      path.join(plugin, '.uapkg', 'config.json'),
      JSON.stringify({
        term: { verbose: true },
      }),
      'utf8',
    );

    const config = createConfig({ cwd: plugin });
    const resolved = config.getAll() as { term: { quiet: boolean; verbose: boolean } };

    expect(resolved.term.quiet).toBe(true);
    expect(resolved.term.verbose).toBe(true);
    expect(config.getWithOrigin('term.verbose')?.source).toBe('local');
    expect(config.trace('term.quiet').map((entry) => entry.source)).toContain('intermediary');
  });

  it('supports isolated instances with independent cwd', () => {
    const root = createTempRoot();
    const a = path.join(root, 'A');
    const b = path.join(root, 'B');

    fs.mkdirSync(path.join(a, '.uapkg'), { recursive: true });
    fs.mkdirSync(path.join(b, '.uapkg'), { recursive: true });
    fs.writeFileSync(
      path.join(a, '.uapkg', 'config.json'),
      '{"registry":"a","registries":{"a":{"url":"https://example.com/a","ref":{"type":"branch","value":"main"}}}}',
      'utf8',
    );
    fs.writeFileSync(
      path.join(b, '.uapkg', 'config.json'),
      '{"registry":"b","registries":{"b":{"url":"https://example.com/b","ref":{"type":"branch","value":"main"}}}}',
      'utf8',
    );

    const configA = createConfig({ cwd: a });
    const configB = createConfig({ cwd: b });

    expect(configA.get('registry')).toBe('a');
    expect(configB.get('registry')).toBe('b');
  });
});
