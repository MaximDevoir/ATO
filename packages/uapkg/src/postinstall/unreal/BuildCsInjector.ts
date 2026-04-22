import fs from 'node:fs';
import { type Result, ok, fail, createIoErrorDiagnostic } from '@uapkg/diagnostics';
import type { ZoneDefinition } from '../api/PostinstallDsl.js';
import { CSharpInjectionEngine } from './CSharpInjectionEngine.js';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { CSharpWrapperFactory } from './CSharpWrapperFactory.js';
import { getWrapperClassName } from './PluginHash.js';

/**
 * Injects a plugin's `setupModules` content into a single `*.Build.cs` file.
 *
 * The operation is idempotent: re-running overwrites the owned marker blocks.
 * All failures are returned as `Result.fail` — this class never throws.
 */
export class BuildCsInjector {
  public constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
  ) {}

  public apply(filePath: string, pluginName: string, zones: ZoneDefinition): Result<void> {
    try {
      let source = fs.readFileSync(filePath, 'utf-8');
      if (zones.includes?.trim()) {
        source = this.injector.applyIncludes(source, pluginName, zones.includes, 'module-includes');
      }
      if (zones.classBody?.trim()) {
        const parsedForWrapper = this.analyzer.parseModule(filePath, source);
        const wrapperClassName = getWrapperClassName(pluginName);
        const wrapper = this.wrapperFactory.createWrapper(
          wrapperClassName,
          'ModuleRules',
          'rules',
          zones.classBody,
        );
        source = this.injector.applyClassWrapper(parsedForWrapper, pluginName, wrapper, 'module-class-body');

        const parsedForCtor = this.analyzer.parseModule(filePath, source);
        source = this.injector.applyConstructorCall(
          parsedForCtor,
          pluginName,
          `${wrapperClassName}.Apply(this)`,
          'module-constructor',
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


