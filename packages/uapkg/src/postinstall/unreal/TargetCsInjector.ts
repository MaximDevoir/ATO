import fs from 'node:fs';
import { type Result, ok, fail, createIoErrorDiagnostic } from '@uapkg/diagnostics';
import type { ZoneDefinition } from '../api/PostinstallDsl.js';
import { CSharpInjectionEngine } from './CSharpInjectionEngine.js';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { CSharpWrapperFactory } from './CSharpWrapperFactory.js';
import { getWrapperClassName } from './PluginHash.js';

/**
 * Injects a plugin's `setupTargets` content into a single `*.Target.cs` file.
 *
 * Mirrors {@link BuildCsInjector} but targets `TargetRules`/`TargetInfo` and a
 * different marker-zone name-space. Never throws — errors become diagnostics.
 */
export class TargetCsInjector {
  public constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
  ) {}

  public apply(filePath: string, pluginName: string, zones: ZoneDefinition): Result<void> {
    try {
      let source = fs.readFileSync(filePath, 'utf-8');
      if (zones.includes?.trim()) {
        source = this.injector.applyIncludes(source, pluginName, zones.includes, 'target-includes');
      }
      if (zones.classBody?.trim()) {
        const parsedForWrapper = this.analyzer.parseTarget(filePath, source);
        const wrapperClassName = getWrapperClassName(pluginName);
        const wrapper = this.wrapperFactory.createWrapper(
          wrapperClassName,
          'TargetRules',
          'target',
          zones.classBody,
        );
        source = this.injector.applyClassWrapper(parsedForWrapper, pluginName, wrapper, 'target-class-body');

        const parsedForCtor = this.analyzer.parseTarget(filePath, source);
        source = this.injector.applyConstructorCall(
          parsedForCtor,
          pluginName,
          `${wrapperClassName}.Apply(this)`,
          'target-constructor',
        );
      }
      fs.writeFileSync(filePath, source, 'utf-8');
      return ok(undefined);
    } catch (error) {
      return fail([
        createIoErrorDiagnostic(filePath, error instanceof Error ? error.message : String(error)),
      ]);
    }
  }
}

