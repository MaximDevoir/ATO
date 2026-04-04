import fs from 'node:fs';
import { CSharpInjectionEngine } from './CSharpInjectionEngine';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer';
import { CSharpWrapperFactory } from './CSharpWrapperFactory';
import { getWrapperClassName } from './PluginHash';

export class BuildCsInjector {
  constructor(
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
    private readonly wrapperFactory: CSharpWrapperFactory = new CSharpWrapperFactory(),
    private readonly injector: CSharpInjectionEngine = new CSharpInjectionEngine(),
  ) {}

  apply(filePath: string, pluginName: string, zones: { includes?: string; classBody?: string }) {
    let source = fs.readFileSync(filePath, 'utf-8');
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
  }
}
