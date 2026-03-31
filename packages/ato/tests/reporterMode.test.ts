import { describe, expect, it } from 'vitest';
import { ATO } from '../src/ATO';

function createATO(argv: string[]) {
  return ATO.fromCommandLine({
    argv: [
      'node',
      'script',
      '--UERoot',
      'D:/dummy/Engine',
      '--Project',
      'D:/ue-projects/ATC_TEST_ENV/TemplateProject/TemplateProject.uproject',
      ...argv,
    ],
  });
}

describe('ATO reporter mode', () => {
  it('defaults to the Ink reporter mode when the terminal supports it', () => {
    const ato = createATO([]);
    Reflect.set(ato, 'canUseInteractiveReporter', () => true);

    expect(Reflect.get(ato, 'reporterMode')).toBe('default');
  });

  it('falls back to basic mode when default reporting is requested but unsupported', () => {
    const ato = createATO([]);
    Reflect.set(ato, 'canUseInteractiveReporter', () => false);

    expect(Reflect.get(ato, 'reporterMode')).toBe('basic');
  });

  it('accepts the basic reporter flag from the command line', () => {
    const ato = createATO(['--reporter', 'basic']);
    Reflect.set(ato, 'canUseInteractiveReporter', () => true);

    expect(Reflect.get(ato, 'reporterMode')).toBe('basic');
  });

  it('accepts the codecov flag from the command line runtime options', () => {
    const ato = createATO(['--codecov']);

    expect(Reflect.get(ato, 'runtimeOptions')).toMatchObject({ codecov: true });
  });

  it('accepts the SimpleAutoBuild flag from the command line runtime options', () => {
    const ato = createATO(['--SimpleAutoBuild']);

    expect(Reflect.get(ato, 'runtimeOptions')).toMatchObject({ simpleAutoBuild: true });
  });
});
