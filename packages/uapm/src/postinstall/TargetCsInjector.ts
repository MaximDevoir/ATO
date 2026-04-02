import fs from 'node:fs';
import { CSharpInjectionEngine } from './CSharpInjectionEngine';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer';
import { CSharpWrapperFactory } from './CSharpWrapperFactory';
import { getWrapperClassName } from './PluginHash';

export class TargetCsInjector {
  constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
  ) {}

  apply(filePath: string, pluginName: string, zones: { includes?: string; classBody?: string }) {
    let source = fs.readFileSync(filePath, 'utf-8');
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
  }
}
