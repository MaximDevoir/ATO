// ---------------------------------------------------------------------------
// New postinstall subsystem — public surface.
//
// The legacy flat files in this directory (PostinstallRunner, BuildCsInjector,
// etc.) remain in place until Phase 10 prunes them, so `packages/uapkg/src/
// index.ts` keeps compiling. New consumers (Phase 8 CLI) should import from
// this barrel only.
// ---------------------------------------------------------------------------

// API
export type { PostinstallDefinition, ProjectSetupDefinition, ZoneDefinition } from './api/PostinstallDsl.js';
export {
  PostinstallDefinitionSchema,
  ProjectSetupSchema,
  ZoneSchema,
} from './api/PostinstallDsl.js';
export { definePostinstall } from './api/definePostinstall.js';

// Loader
export { EntryResolver, type PostinstallEntryKind, type ResolvedEntry } from './loader/EntryResolver.js';
export { EsbuildTranspiler } from './loader/EsbuildTranspiler.js';
export { ExportValidator } from './loader/ExportValidator.js';
export { ModuleImporter, type ModuleSource } from './loader/ModuleImporter.js';
export { PostinstallLoader, type LoadedPostinstall } from './loader/PostinstallLoader.js';

// Policy
export {
  PostinstallPolicyGate,
  type PolicyDecision,
  type PolicyConfigReader,
} from './policy/PostinstallPolicyGate.js';

// Markers
export { MarkerBlockEditor } from './markers/MarkerBlockEditor.js';
export { MarkerBlockService } from './markers/MarkerBlockService.js';
export {
  MarkerIntegrityValidator,
  type MarkerIntegrityResult,
  type MarkerIntegrityOk,
  type MarkerIntegrityFail,
} from './markers/MarkerIntegrityValidator.js';

// Unreal
export { BuildCsInjector } from './unreal/BuildCsInjector.js';
export { CSharpInjectionEngine } from './unreal/CSharpInjectionEngine.js';
export { CSharpStructureAnalyzer } from './unreal/CSharpStructureAnalyzer.js';
export type {
  CSharpFileKind,
  ParsedClass,
  ParsedConstructor,
  ParsedCSharpFile,
} from './unreal/CSharpStructures.js';
export { CSharpWrapperFactory, type WrapperContextType } from './unreal/CSharpWrapperFactory.js';
export { getPluginHash, getWrapperClassName } from './unreal/PluginHash.js';
export { PrettyParseError } from './unreal/PrettyParseError.js';
export { ProjectFileLocator } from './unreal/ProjectFileLocator.js';
export { TargetCsInjector } from './unreal/TargetCsInjector.js';
export { UnrealSourceCatalogBuilder, type SourceCatalog } from './unreal/UnrealSourceCatalog.js';
export { UProjectInjector } from './unreal/UProjectInjector.js';
export { UProjectMetadataReader } from './unreal/UProjectMetadataReader.js';

// Runner
export {
  PostinstallOrchestrator,
  type PostinstallCandidate,
  type PostinstallOrchestratorInput,
  type PostinstallReport,
} from './runner/PostinstallOrchestrator.js';


