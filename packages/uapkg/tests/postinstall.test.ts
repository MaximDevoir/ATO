import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BuildCsInjector } from '../src/postinstall/BuildCsInjector';
import { PostinstallModuleSelector } from '../src/postinstall/PostinstallModuleSelector';
import { TargetCsInjector } from '../src/postinstall/TargetCsInjector';
import { UProjectInjector } from '../src/postinstall/UProjectInjector';

describe('BuildCsInjector', () => {
  it('injects includes, wrapper, and constructor call idempotently', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-buildcs-'));
    const buildPath = path.join(tempDir, 'MyGame.Build.cs');
    const original = [
      'using UnrealBuildTool;',
      '',
      'public class MyGame : ModuleRules',
      '{',
      '    public MyGame(ReadOnlyTargetRules Target) : base(Target)',
      '    {',
      '        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;',
      '    }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(buildPath, original, 'utf-8');

    const injector = new BuildCsInjector();
    injector.apply(buildPath, 'AwesomeInventory', {
      includes: 'using System.IO;',
      classBody: 'rules.PublicDependencyModuleNames.Add("AwesomeCoreUtils");',
    });
    injector.apply(buildPath, 'AwesomeInventory', {
      includes: 'using System.IO;',
      classBody: 'rules.PublicDependencyModuleNames.Add("AwesomeCoreUtils");',
    });

    const source = fs.readFileSync(buildPath, 'utf-8');
    expect(source.match(/UAPKG-BEGIN AwesomeInventory:module-includes/g)?.length ?? 0).toBe(1);
    expect(source.match(/UAPKG-BEGIN AwesomeInventory:module-class-body/g)?.length ?? 0).toBe(1);
    expect(source.match(/UAPKG-BEGIN AwesomeInventory:module-constructor/g)?.length ?? 0).toBe(1);
    expect(source).toContain('UAPKG_');
    expect(source).toContain('Apply(this);');
  });
});

describe('TargetCsInjector', () => {
  it('fails when TargetType assignment is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-targetcs-'));
    const targetPath = path.join(tempDir, 'MyGame.Target.cs');
    const original = [
      'using UnrealBuildTool;',
      '',
      'public class MyGameTarget : TargetRules',
      '{',
      '    public MyGameTarget(TargetInfo Target) : base(Target)',
      '    {',
      '    }',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(targetPath, original, 'utf-8');

    const injector = new TargetCsInjector();
    expect(() =>
      injector.apply(targetPath, 'AwesomeInventory', {
        classBody: 'if (target.Type == TargetType.Editor) { }',
      }),
    ).toThrow(/TargetType/);
  });
});

describe('UProjectInjector', () => {
  it('adds and enables plugins while preserving existing entries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-uproject-'));
    const uprojectPath = path.join(tempDir, 'MyGame.uproject');
    fs.writeFileSync(
      uprojectPath,
      `${JSON.stringify(
        {
          FileVersion: 3,
          Plugins: [{ Name: 'SPUD', Enabled: false, MarketplaceURL: 'x' }],
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );

    new UProjectInjector().apply(uprojectPath, ['SPUD', 'AwesomeInventory']);
    const parsed = JSON.parse(fs.readFileSync(uprojectPath, 'utf-8')) as {
      Plugins: Array<{ Name: string; Enabled: boolean; MarketplaceURL?: string }>;
    };
    expect(parsed.Plugins.find((entry) => entry.Name === 'SPUD')?.Enabled).toBe(true);
    expect(parsed.Plugins.find((entry) => entry.Name === 'SPUD')?.MarketplaceURL).toBe('x');
    expect(parsed.Plugins.find((entry) => entry.Name === 'AwesomeInventory')?.Enabled).toBe(true);
  });
});

describe('PostinstallModuleSelector', () => {
  it('discovers modules from uproject when explicit postinstall modules are not configured', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-module-selector-'));
    fs.writeFileSync(
      path.join(tempDir, 'MyGame.uproject'),
      `${JSON.stringify(
        {
          Modules: [{ Name: 'MyGame' }, { Name: 'MyGameEditor' }],
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'uapkg.json'),
      `${JSON.stringify(
        {
          name: 'MyGame',
          type: 'project',
          dependencies: [],
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );

    const resolved = new PostinstallModuleSelector().resolve(tempDir);
    expect(resolved).toEqual(['MyGame', 'MyGameEditor']);
  });

  it('uses explicit project postinstall modules when provided', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uapkg-module-selector-'));
    fs.writeFileSync(
      path.join(tempDir, 'MyGame.uproject'),
      `${JSON.stringify(
        {
          Modules: [{ Name: 'MyGame' }, { Name: 'MyGameEditor' }],
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tempDir, 'uapkg.json'),
      `${JSON.stringify(
        {
          name: 'MyGame',
          type: 'project',
          dependencies: [],
          postinstall: {
            modules: ['MyGame'],
          },
        },
        null,
        2,
      )}\n`,
      'utf-8',
    );

    const resolved = new PostinstallModuleSelector().resolve(tempDir);
    expect(resolved).toEqual(['MyGame']);
  });
});
