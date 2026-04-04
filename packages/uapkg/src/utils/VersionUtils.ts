import semver from 'semver';

export function normalizeAddedDependencyVersion(ref?: string) {
  if (!ref) {
    return undefined;
  }

  if (ref === '*' || ref.startsWith('^') || ref.startsWith('~') || ref.startsWith('=')) {
    return ref;
  }

  const cleaned = semver.clean(ref);
  if (cleaned) {
    return `^${cleaned}`;
  }

  return ref;
}
