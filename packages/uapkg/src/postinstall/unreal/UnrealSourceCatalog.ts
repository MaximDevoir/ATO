import fs from 'node:fs';
import { CSharpStructureAnalyzer } from './CSharpStructureAnalyzer.js';
import { ProjectFileLocator } from './ProjectFileLocator.js';

export interface SourceCatalog {
  /** ModuleName → absolute path of its `*.Build.cs`. */
  readonly moduleFiles: ReadonlyMap<string, string>;
  /** Absolute paths to every `*.Target.cs` in the project source tree. */
  readonly targetFiles: readonly string[];
}

/**
 * Scans the project source tree and validates every discovered `Build.cs` /
 * `Target.cs` with {@link CSharpStructureAnalyzer}. This is a one-shot
 * pre-flight check: the orchestrator runs it once before any injector mutates
 * a file, so we fail fast on malformed sources.
 */
export class UnrealSourceCatalogBuilder {
  public constructor(
    private readonly fileLocator: ProjectFileLocator = new ProjectFileLocator(),
    private readonly analyzer: CSharpStructureAnalyzer = new CSharpStructureAnalyzer(),
  ) {}

  public build(projectRoot: string, expectedModules: readonly string[]): SourceCatalog {
    const moduleFiles = this.resolveModules(projectRoot, expectedModules);
    const targetFiles = this.resolveTargets(projectRoot);
    return { moduleFiles, targetFiles };
  }

  private resolveModules(projectRoot: string, expectedModules: readonly string[]): Map<string, string> {
    const files = this.fileLocator.findBuildFiles(projectRoot);
    const discovered = new Map<string, string>();
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const parsed = this.analyzer.parseModule(filePath, source);
      if (discovered.has(parsed.classInfo.className)) {
        throw new Error(
          `Duplicate ModuleRules class '${parsed.classInfo.className}' in ${discovered.get(parsed.classInfo.className)} and ${filePath}`,
        );
      }
      discovered.set(parsed.classInfo.className, filePath);
    }

    const missing = expectedModules.filter((name) => !discovered.has(name));
    if (missing.length > 0) {
      throw new Error(`Missing module Build.cs files for: ${missing.join(', ')}`);
    }

    const moduleFiles = new Map<string, string>();
    for (const moduleName of expectedModules) {
      moduleFiles.set(moduleName, discovered.get(moduleName) as string);
    }
    return moduleFiles;
  }

  private resolveTargets(projectRoot: string): string[] {
    const files = this.fileLocator.findTargetFiles(projectRoot);
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf-8');
      this.analyzer.parseTarget(filePath, source);
    }
    return files;
  }
}
