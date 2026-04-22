// ---------------------------------------------------------------------------
// @uapkg/uapkg — public API
//
// Phase 8 rewrite: this barrel exposes the new composition-root driven
// command surface. Legacy exports (DependencyGraphBuilder, TOMLLockfileRepository,
// DependencyInstaller, SafetyPolicy, UAPKGManifest types, etc.) were removed
// in Phase 10.
// ---------------------------------------------------------------------------

// Application dispatcher + composition root
export { CompositionRoot, type CompositionRootOptions } from './app/CompositionRoot.js';
export { UAPKGApplication } from './app/UAPKGApplication.js';

// CLI
export { parseUAPKGCommandLine } from './cli/parseCommandLine.js';
export { runUAPKGCLI } from './cli/runUAPKGCLI.js';
export type { UAPKGCommandLine } from './cli/UAPKGCommandLine.js';
export { createUAPKGCommandLineFactory, UAPKGCommandLineFactory } from './cli/UAPKGCommandLine.js';

// Commands — new surface
export { AddCommand, type AddCommandOptions } from './commands/AddCommand.js';
export { InstallCommand, type InstallCommandOptions } from './commands/InstallCommand.js';
export { ListCommand, type ListCommandOptions } from './commands/ListCommand.js';
export { OutdatedCommand, type OutdatedCommandOptions } from './commands/OutdatedCommand.js';
export { RemoveCommand, type RemoveCommandOptions } from './commands/RemoveCommand.js';
export { UpdateCommand, type UpdateCommandOptions } from './commands/UpdateCommand.js';
export { WhyCommand, type WhyCommandOptions } from './commands/WhyCommand.js';
// Commands — kept from pre-Phase-8 (already compose with the new packages)
export { ConfigCommand } from './commands/ConfigCommand.js';
export { InitCommand } from './commands/InitCommand.js';
export { PackCommand } from './commands/PackCommand.js';
export { ProjectGetNameCommand } from './commands/ProjectGetNameCommand.js';

// Reporting
export { DiagnosticReporter } from './reporting/DiagnosticReporter.js';
export { InstallProgressReporter } from './reporting/InstallProgressReporter.js';
export { JsonReporter, type JsonEnvelope } from './reporting/JsonReporter.js';

// Postinstall — new subsystem (Phase 7)
export * from './postinstall/index.js';

// Legacy re-exports retained for external consumers (e.g. create-atc-harness).
// These will move onto `@uapkg/package-manifest` in a follow-up, after which
// they can be deleted.
export { FileManifestRepository } from './manifest/ManifestRepository.js';
export type { ManifestType, UAPKGManifest } from './domain/UAPKGManifest.js';
export { UAPKGManifestSchema } from './domain/UAPKGManifest.js';


