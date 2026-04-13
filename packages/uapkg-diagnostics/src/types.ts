import type { GeneralDiagnostic } from './general/GeneralDiagnostics.js';
import type { ManifestDiagnostic } from './manifest/ManifestDiagnostics.js';
import type { PackDiagnostic } from './pack/PackDiagnostics.js';
import type { RegistryDiagnostic } from './registry/RegistryDiagnostics.js';
import type { ResolverDiagnostic } from './resolver/ResolverDiagnostics.js';

/**
 * The unified Diagnostic type — a discriminated union of every known
 * diagnostic, keyed on `code`.
 *
 * To add a new diagnostic:
 *   1. Create its type in the appropriate family file.
 *   2. Add it to that family's union.
 *   3. It is automatically part of `Diagnostic` through this re-export.
 */
export type Diagnostic =
  | ResolverDiagnostic
  | RegistryDiagnostic
  | ManifestDiagnostic
  | PackDiagnostic
  | GeneralDiagnostic;

/**
 * Extract a specific diagnostic by code.
 *
 * @example
 * type VC = DiagnosticByCode<'VERSION_CONFLICT'>;
 */
export type DiagnosticByCode<C extends Diagnostic['code']> = Extract<Diagnostic, { code: C }>;

/** All known diagnostic codes. */
export type DiagnosticCode = Diagnostic['code'];
