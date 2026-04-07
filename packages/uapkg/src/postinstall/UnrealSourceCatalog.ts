import fs from 'node:fs';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { ProjectFileLocator } from './ProjectFileLocator.js';

export interface SourceCatalog {
  moduleFiles: Map<string, string>;
  targetFiles: string[];
}

export class UnrealSourceCatalogBuilder {
  constructor(
    private readonly fileLocator: ProjectFileLocator = new ProjectFileLocator(),
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
  ) {}

  build(projectRoot: string, expectedModules: string[]): SourceCatalog {
    const moduleFiles = this.resolveModules(projectRoot, expectedModules);
    const targetFiles = this.resolveTargets(projectRoot);
    return {
      moduleFiles,
      targetFiles,
    };
  }

  private resolveModules(projectRoot: string, expectedModules: string[]) {
    const files = this.fileLocator.findBuildFiles(projectRoot);
    const discovered = new Map<string, string>();
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.analyzer.parseModule(filePath, source);
      if (discovered.has(parsed.classInfo.className)) {
        throw new Error(
          `[uapkg] Duplicate ModuleRules class '${parsed.classInfo.className}' in ${discovered.get(parsed.classInfo.className)} and ${filePath}`,
        );
      }
      discovered.set(parsed.classInfo.className, filePath);
    }

    const missing = expectedModules.filter((name) => !discovered.has(name));
    if (missing.length > 0) {
      throw new Error(`[uapkg] Missing module Build.cs files for: ${missing.join(', ')}`);
    }

    const moduleFiles = new Map<string, string>();
    for (const moduleName of expectedModules) {
      moduleFiles.set(moduleName, discovered.get(moduleName) as string);
    }
    return moduleFiles;
  }

  private resolveTargets(projectRoot: string) {
    const files = this.fileLocator.findTargetFiles(projectRoot);
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf-8');
      this.analyzer.parseTarget(filePath, source);
    }
    return files;
  }
}
