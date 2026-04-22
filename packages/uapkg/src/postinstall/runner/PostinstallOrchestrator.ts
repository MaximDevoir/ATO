import type { Diagnostic, Result } from '@uapkg/diagnostics';
import { DiagnosticBag, createIoErrorDiagnostic, createUnknownErrorDiagnostic } from '@uapkg/diagnostics';
import type { PostinstallDefinition } from '../api/PostinstallDsl.js';
import { PostinstallLoader, type LoadedPostinstall } from '../loader/PostinstallLoader.js';
import { PostinstallPolicyGate } from '../policy/PostinstallPolicyGate.js';
import { BuildCsInjector } from '../unreal/BuildCsInjector.js';
import { ProjectFileLocator } from '../unreal/ProjectFileLocator.js';
import { TargetCsInjector } from '../unreal/TargetCsInjector.js';
import { UnrealSourceCatalogBuilder } from '../unreal/UnrealSourceCatalog.js';
import { UProjectInjector } from '../unreal/UProjectInjector.js';
import { UProjectMetadataReader } from '../unreal/UProjectMetadataReader.js';

/**
 * Projection of an installer action that the orchestrator needs. The CLI
 * (Phase 8) will map `InstallAction` → `PostinstallCandidate` by filtering
 * `type === 'add' | 'update'` and joining with the lockfile for registry
 * metadata.
 */
export interface PostinstallCandidate {
  readonly packageName: string;
  readonly registry: string;
  /** Absolute path to the installed plugin root. */
  readonly pluginRoot: string;
}

export interface PostinstallReport {
  readonly executed: readonly string[];
  readonly skipped: readonly { packageName: string; reason: 'no-script' | 'policy-denied' }[];
}

export interface PostinstallOrchestratorInput {
  readonly projectRoot: string;
  readonly manifestType: 'project' | 'plugin';
  readonly candidates: readonly PostinstallCandidate[];
}

/**
 * Top-level postinstall flow:
 *
 *   1. Fast path: if the host is a plugin manifest, nothing runs.
 *   2. For each candidate plugin:
 *        a. PolicyGate decides allow/deny. Deny → info diagnostic, skip.
 *        b. Loader locates + transpiles + imports + validates the script.
 *        c. Accumulate `(plugin, definition)` pairs into a plan.
 *   3. Build a single {@link UnrealSourceCatalog} covering every module
 *      any script wants to touch.
 *   4. Apply injectors idempotently per zone.
 *
 * Always returns a {@link Result}; never throws. The caller inspects
 * `diagnostics` to render errors/warnings/info lines.
 */
export class PostinstallOrchestrator {
  public constructor(
    private readonly loader: PostinstallLoader = new PostinstallLoader(),
    private readonly policy: PostinstallPolicyGate = new PostinstallPolicyGate(),
    private readonly catalogBuilder: UnrealSourceCatalogBuilder = new UnrealSourceCatalogBuilder(),
    private readonly buildInjector: BuildCsInjector = new BuildCsInjector(),
    private readonly targetInjector: TargetCsInjector = new TargetCsInjector(),
    private readonly projectInjector: UProjectInjector = new UProjectInjector(),
    private readonly projectFileLocator: ProjectFileLocator = new ProjectFileLocator(),
    private readonly uprojectReader: UProjectMetadataReader = new UProjectMetadataReader(),
  ) {}

  public async run(input: PostinstallOrchestratorInput): Promise<Result<PostinstallReport>> {
    const bag = new DiagnosticBag();
    const executed: string[] = [];
    const skipped: { packageName: string; reason: 'no-script' | 'policy-denied' }[] = [];

    if (input.manifestType !== 'project' || input.candidates.length === 0) {
      return bag.toResult({ executed, skipped });
    }

    const plan = await this.buildPlan(input.candidates, bag, skipped);
    if (plan.length === 0) {
      return bag.toResult({ executed, skipped });
    }

    const catalogResult = this.buildCatalog(input.projectRoot, plan);
    if (!catalogResult.ok) {
      bag.mergeArray(catalogResult.diagnostics);
      return bag.toFailure();
    }
    const { catalog, moduleNames } = catalogResult.value;

    for (const entry of plan) {
      const applied = this.applyScript(input.projectRoot, entry, catalog, moduleNames, bag);
      if (applied) executed.push(entry.loaded.packageName);
    }

    return bag.toResult({ executed, skipped });
  }

  // ---- private helpers --------------------------------------------------

  private async buildPlan(
    candidates: readonly PostinstallCandidate[],
    bag: DiagnosticBag,
    skipped: { packageName: string; reason: 'no-script' | 'policy-denied' }[],
  ): Promise<Array<{ candidate: PostinstallCandidate; loaded: LoadedPostinstall }>> {
    const plan: Array<{ candidate: PostinstallCandidate; loaded: LoadedPostinstall }> = [];
    for (const candidate of candidates) {
      const decision = this.policy.evaluate(candidate.packageName, candidate.registry);
      if (!decision.allowed) {
        if (decision.denialDiagnostic) bag.add(decision.denialDiagnostic);
        skipped.push({ packageName: candidate.packageName, reason: 'policy-denied' });
        continue;
      }
      const loaded = await this.loader.load(candidate.packageName, candidate.pluginRoot);
      bag.mergeArray(loaded.diagnostics);
      if (!loaded.ok) continue; // Errors already in bag.
      if (loaded.value === null) {
        skipped.push({ packageName: candidate.packageName, reason: 'no-script' });
        continue;
      }
      plan.push({ candidate, loaded: loaded.value });
    }
    return plan;
  }

  private buildCatalog(
    projectRoot: string,
    plan: Array<{ candidate: PostinstallCandidate; loaded: LoadedPostinstall }>,
  ): Result<{ catalog: ReturnType<UnrealSourceCatalogBuilder['build']>; moduleNames: readonly string[] }> {
    const hasModuleSetup = plan.some((entry) => Boolean(entry.loaded.definition.setupModules));
    let moduleNames: readonly string[] = [];
    if (hasModuleSetup) {
      try {
        const uprojectPath = this.projectFileLocator.findProjectFile(projectRoot);
        moduleNames = this.uprojectReader.readModuleNames(uprojectPath);
      } catch (error) {
        return {
          ok: false,
          diagnostics: [
            createIoErrorDiagnostic(projectRoot, error instanceof Error ? error.message : String(error)),
          ],
        };
      }
    }

    try {
      const catalog = this.catalogBuilder.build(projectRoot, moduleNames);
      return { ok: true, value: { catalog, moduleNames }, diagnostics: [] };
    } catch (error) {
      return {
        ok: false,
        diagnostics: [createUnknownErrorDiagnostic(error instanceof Error ? error.message : String(error))],
      };
    }
  }

  private applyScript(
    projectRoot: string,
    entry: { candidate: PostinstallCandidate; loaded: LoadedPostinstall },
    catalog: ReturnType<UnrealSourceCatalogBuilder['build']>,
    moduleNames: readonly string[],
    bag: DiagnosticBag,
  ): boolean {
    const { loaded } = entry;
    const def: PostinstallDefinition = loaded.definition;
    let anyFailed = false;

    if (def.setupModules) {
      for (const moduleName of moduleNames) {
        const moduleFile = catalog.moduleFiles.get(moduleName);
        if (!moduleFile) {
          bag.add(
            createUnknownErrorDiagnostic(`Missing module mapping for ${moduleName} (plugin ${loaded.packageName})`),
          );
          anyFailed = true;
          continue;
        }
        const result = this.buildInjector.apply(moduleFile, loaded.packageName, def.setupModules);
        this.absorb(result, bag, () => { anyFailed = true; });
      }
    }

    if (def.setupTargets) {
      for (const targetFile of catalog.targetFiles) {
        const result = this.targetInjector.apply(targetFile, loaded.packageName, def.setupTargets);
        this.absorb(result, bag, () => { anyFailed = true; });
      }
    }

    const projectPlugins = def.setupProject?.plugins ?? [];
    if (projectPlugins.length > 0) {
      try {
        const uprojectPath = this.projectFileLocator.findProjectFile(projectRoot);
        const result = this.projectInjector.apply(uprojectPath, projectPlugins);
        this.absorb(result, bag, () => { anyFailed = true; });
      } catch (error) {
        bag.add(createIoErrorDiagnostic(projectRoot, error instanceof Error ? error.message : String(error)));
        anyFailed = true;
      }
    }

    return !anyFailed;
  }

  private absorb(result: Result<void>, bag: DiagnosticBag, onFail: () => void): void {
    for (const d of result.diagnostics) bag.add(d as Diagnostic);
    if (!result.ok) onFail();
  }
}

