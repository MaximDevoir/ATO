const GIT_HARNESS_PATTERNS = [
  /^git\+https:\/\//i,
  /^https:\/\/.+\.git(?:(?:#|@).+)?$/i,
  /^git@[^:]+:[^#]+(?:(?:#|@).+)?$/i,
];

export function isGitLikeReference(value: string) {
  return GIT_HARNESS_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

export interface ParsedGitReference {
  repositoryUrl: string;
  ref?: string;
}

export function parseGitReference(value: string): ParsedGitReference {
  const trimmed = value.trim();

  let normalized = trimmed;
  if (normalized.startsWith('git+https://')) {
    normalized = `https://${normalized.slice('git+https://'.length)}`;
  }

  const hashSeparatorIndex = normalized.indexOf('#');
  if (hashSeparatorIndex >= 0) {
    const repositoryUrl = normalized.slice(0, hashSeparatorIndex).trim();
    const ref = normalized.slice(hashSeparatorIndex + 1).trim();
    return {
      repositoryUrl,
      ref: ref || undefined,
    };
  }

  const atTagMatch = /^(.*\.git)@(.+)$/.exec(normalized);
  if (atTagMatch) {
    return {
      repositoryUrl: atTagMatch[1].trim(),
      ref: atTagMatch[2].trim() || undefined,
    };
  }

  return { repositoryUrl: normalized };
}
