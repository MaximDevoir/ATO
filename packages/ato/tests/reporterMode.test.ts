import { describe, expect, it } from 'vitest';
import { ATO } from '../src/ATO';

describe('ATO reporter mode', () => {
  it('defaults to the Ink reporter mode when no reporter flag is provided', () => {
    const ato = ATO.fromCommandLine({
      argv: [
        'node',
        'script',
        '--UERoot',
        'D:/dummy/Engine',
        '--Project',
        'D:/ue-projects/ATC_TEST_ENV/TemplateProject/TemplateProject.uproject',
      ],
    });

    expect(Reflect.get(ato, 'reporterMode')).toBe('default');
  });

  it('accepts the basic reporter flag from the command line', () => {
    const ato = ATO.fromCommandLine({
      argv: [
        'node',
        'script',
        '--UERoot',
        'D:/dummy/Engine',
        '--Project',
        'D:/ue-projects/ATC_TEST_ENV/TemplateProject/TemplateProject.uproject',
        '--reporter',
        'basic',
      ],
    });

    expect(Reflect.get(ato, 'reporterMode')).toBe('basic');
  });
});
