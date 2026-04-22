import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// Spec-parse diagnostics (CLI package specifier parsing: `@org/name@range`)
// ---------------------------------------------------------------------------

/** The raw CLI specifier could not be parsed into `(@org/)?name(@range)?`. */
export type InvalidPackageSpecDiagnostic = DiagnosticBase<
  'INVALID_PACKAGE_SPEC',
  {
    readonly input: string;
    readonly reason: string;
  }
>;

/** Organization portion of a package spec was not a valid OrgName. */
export type InvalidOrgNameDiagnostic = DiagnosticBase<
  'INVALID_ORG_NAME',
  {
    readonly input: string;
    readonly org: string;
  }
>;

/** Version range portion of a package spec was not a valid semver range. */
export type InvalidVersionRangeDiagnostic = DiagnosticBase<
  'INVALID_VERSION_RANGE',
  {
    readonly input: string;
    readonly range: string;
  }
>;

export type SpecParseDiagnostic =
  | InvalidPackageSpecDiagnostic
  | InvalidOrgNameDiagnostic
  | InvalidVersionRangeDiagnostic;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createInvalidPackageSpecDiagnostic(input: string, reason: string): InvalidPackageSpecDiagnostic {
  return {
    level: 'error',
    code: 'INVALID_PACKAGE_SPEC',
    message: `Invalid package specifier "${input}": ${reason}.`,
    hint: 'Use the form "(@org/)?name(@range)?" — e.g. "@myorg/my-pkg@^1.0.0".',
    data: { input, reason },
  };
}

export function createInvalidOrgNameDiagnostic(input: string, org: string): InvalidOrgNameDiagnostic {
  return {
    level: 'error',
    code: 'INVALID_ORG_NAME',
    message: `Invalid organization name "${org}" in specifier "${input}".`,
    hint: 'Organization names must be lowercase alphanumeric with hyphens or underscores.',
    data: { input, org },
  };
}

export function createInvalidVersionRangeDiagnostic(input: string, range: string): InvalidVersionRangeDiagnostic {
  return {
    level: 'error',
    code: 'INVALID_VERSION_RANGE',
    message: `Invalid semver range "${range}" in specifier "${input}".`,
    hint: 'Use a valid semver range like "^1.0.0", "~2.3.4", or ">=1.0.0 <2.0.0".',
    data: { input, range },
  };
}

