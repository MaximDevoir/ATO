import fs from 'node:fs';
import { createIoErrorDiagnostic, fail, ok, type Result } from '@uapkg/diagnostics';
import type { ZoneDefinition } from '../api/PostinstallDsl.js';
import { MarkerBlockEditor } from '../markers/MarkerBlockEditor.js';
import { CSharpInjectionEngine } from './CSharpInjectionEngine.js';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { CSharpWrapperFactory } from './CSharpWrapperFactory.js';
import { getWrapperClassName } from './PluginHash.js';

const TARGET_CS_ZONES = ['target-includes', 'target-class-body', 'target-constructor'] as const;

/**
 * Injects a plugin's `setupTargets` content into a single `*.Target.cs` file.
 *
 * Mirrors {@link BuildCsInjector} but targets `TargetRules`/`TargetInfo` and a
 * different marker-zone name-space. Never throws — errors become diagnostics.
 * Pre-existing owned marker blocks are integrity-checked before mutation and
 * surfaced as `POSTINSTALL_MARKER_CORRUPT` on failure.
 */
export class TargetCsInjector {
  public constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
    private readonly markerEditor: MarkerBlockEditor = new MarkerBlockEditor(),
  ) {}

  public apply(filePath: string, pluginName: string, zones: ZoneDefinition): Result<void> {
    try {
      let source = fs.readFileSync(filePath, 'utf-8');

      for (const zone of TARGET_CS_ZONES) {
        const check = this.markerEditor.validate(source, pluginName, zone, filePath);
        if (!check.ok) return fail(check.diagnostics);
      }

      if (zones.includes?.trim()) {
        source = this.injector.applyIncludes(source, pluginName, zones.includes, 'target-includes');
      }
      if (zones.classBody?.trim()) {
        const parsedForWrapper = this.analyzer.parseTarget(filePath, source);
        const wrapperClassName = getWrapperClassName(pluginName);
        const wrapper = this.wrapperFactory.createWrapper(wrapperClassName, 'TargetRules', 'target', zones.classBody);
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
      return fail([createIoErrorDiagnostic(filePath, error instanceof Error ? error.message : String(error))]);
    }
  }
}
