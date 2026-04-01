const GIT_HARNESS_PATTERNS = [/^git\+https:\/\//i, /^https:\/\/.+\.git(?:#.+)?$/i, /^git@[^:]+:[^#]+(?:#.+)?$/i];

export function isGitLikeReference(value: string) {
  return GIT_HARNESS_PATTERNS.some((pattern) => pattern.test(value.trim()));
}
