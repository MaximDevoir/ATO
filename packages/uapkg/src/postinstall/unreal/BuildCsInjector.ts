import fs from 'node:fs';
import { createIoErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { ZoneDefinition } from '../api/PostinstallDsl.js';
import { MarkerBlockEditor } from '../markers/MarkerBlockEditor.js';
import { CSharpInjectionEngine } from './CSharpInjectionEngine.js';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { CSharpWrapperFactory } from './CSharpWrapperFactory.js';
import { getWrapperClassName } from './PluginHash.js';

const BUILD_CS_ZONES = ['module-includes', 'module-class-body', 'module-constructor'] as const;

/**
 * Injects a plugin's `setupModules` content into a single `*.Build.cs` file.
 *
 * The operation is idempotent: re-running overwrites the owned marker blocks.
 * All failures are returned as `Result.fail` — this class never throws. Before
 * mutation, pre-existing owned marker blocks are checked for corruption
 * (orphaned / nested markers) and surfaced as `POSTINSTALL_MARKER_CORRUPT`.
 */
export class BuildCsInjector {
  public constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
    private readonly markerEditor: MarkerBlockEditor = new MarkerBlockEditor(),
  ) {}

  public apply(filePath: string, pluginName: string, zones: ZoneDefinition): Result<void> {
    try {
      let source = fs.readFileSync(filePath, 'utf-8');

      for (const zone of BUILD_CS_ZONES) {
        const check = this.markerEditor.validate(source, pluginName, zone, filePath);
        if (!check.ok) return fail(check.diagnostics);
      }

      if (zones.includes?.trim()) {
        source = this.injector.applyIncludes(source, pluginName, zones.includes, 'module-includes');
      }
      if (zones.classBody?.trim()) {
        const parsedForWrapper = this.analyzer.parseModule(filePath, source);
        const wrapperClassName = getWrapperClassName(pluginName);
        const wrapper = this.wrapperFactory.createWrapper(wrapperClassName, 'ModuleRules', 'rules', zones.classBody);
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
      return fail([createIoErrorDiagnostic(filePath, error instanceof Error ? error.message : String(error))]);
    }
  }
}
