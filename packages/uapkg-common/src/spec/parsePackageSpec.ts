import {
  OrgNameSchema,
  type PackageName,
  PackageNameSchema,
  type PackageSpec,
  type VersionRange,
  VersionRangeSchema,
} from '@uapkg/common-schema';
import {
  createInvalidOrgNameDiagnostic,
  createInvalidPackageSpecDiagnostic,
  createInvalidVersionRangeDiagnostic,
  fail,
  ok,
  type Result,
} from '@uapkg/diagnostics';

/**
 * Parse a CLI package specifier of the form:
 *
 *   (@<org>/)?<name>(@<range>)?
 *
 * Examples:
 *   - "awesome-pkg"                     → { name }
 *   - "awesome-pkg@^1.0.0"              → { name, range }
 *   - "@myorg/awesome-pkg"              → { org, name }
 *   - "@myorg/awesome-pkg@^1.0.0"       → { org, name, range }
 *
 * Never throws; returns a `Result<PackageSpec>` with typed diagnostics.
 */
export function parsePackageSpec(input: string): Result<PackageSpec> {
  const raw = (input ?? '').trim();
  if (raw.length === 0) {
    return fail([createInvalidPackageSpecDiagnostic(input, 'specifier is empty')]);
  }

  let rest = raw;
  let orgRaw: string | undefined;

  // Scoped org: starts with '@', then <org>/<rest>
  if (rest.startsWith('@')) {
    const slash = rest.indexOf('/');
    if (slash < 0) {
      return fail([createInvalidPackageSpecDiagnostic(input, 'scoped specifier is missing "/" after "@org"')]);
    }
    orgRaw = rest.slice(1, slash);
    rest = rest.slice(slash + 1);
    if (rest.length === 0) {
      return fail([createInvalidPackageSpecDiagnostic(input, 'package name is missing after "@org/"')]);
    }
  }

  // Version range (at-separated) — first '@' in the unscoped remainder
  let nameRaw = rest;
  let rangeRaw: string | undefined;
  const at = rest.indexOf('@');
  if (at >= 0) {
    nameRaw = rest.slice(0, at);
    rangeRaw = rest.slice(at + 1);
    if (nameRaw.length === 0) {
      return fail([createInvalidPackageSpecDiagnostic(input, 'package name is empty before "@"')]);
    }
    if (rangeRaw.length === 0) {
      return fail([createInvalidPackageSpecDiagnostic(input, 'version range is empty after "@"')]);
    }
  }

  // Validate the pieces via their schemas
  let org: PackageSpec['org'];
  if (orgRaw !== undefined) {
    const orgResult = OrgNameSchema.safeParse(orgRaw);
    if (!orgResult.success) {
      return fail([createInvalidOrgNameDiagnostic(input, orgRaw)]);
    }
    org = orgResult.data;
  }

  const nameResult = PackageNameSchema.safeParse(nameRaw);
  if (!nameResult.success) {
    return fail([createInvalidPackageSpecDiagnostic(input, `invalid package name "${nameRaw}"`)]);
  }
  const name: PackageName = nameResult.data;

  let range: VersionRange | undefined;
  if (rangeRaw !== undefined) {
    const rangeResult = VersionRangeSchema.safeParse(rangeRaw);
    if (!rangeResult.success) {
      return fail([createInvalidVersionRangeDiagnostic(input, rangeRaw)]);
    }
    range = rangeResult.data;
  }

  return ok({ org, name, range });
}

/** Inverse of `parsePackageSpec` — renders a `PackageSpec` back to its string form. */
export function formatPackageSpec(spec: PackageSpec): string {
  const scope = spec.org ? `@${spec.org}/` : '';
  const range = spec.range ? `@${spec.range}` : '';
  return `${scope}${spec.name}${range}`;
}
