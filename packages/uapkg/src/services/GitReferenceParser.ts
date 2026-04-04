export interface ParsedGitReference {
  source: string;
  repositoryUrl: string;
  ref?: string;
}

export function parseGitReference(value: string): ParsedGitReference {
  const trimmed = value.trim();

  let normalized = trimmed;
  if (normalized.startsWith('git+https://')) {
    normalized = `https://${normalized.slice('git+https://'.length)}`;
  }

  const hashSeparator = normalized.indexOf('#');
  if (hashSeparator >= 0) {
    const repositoryUrl = normalized.slice(0, hashSeparator).trim();
    const ref = normalized.slice(hashSeparator + 1).trim() || undefined;
    return { source: trimmed, repositoryUrl, ref };
  }

  const atRefMatch = /^(.*\.git)@(.+)$/.exec(normalized);
  if (atRefMatch) {
    return {
      source: trimmed,
      repositoryUrl: atRefMatch[1].trim(),
      ref: atRefMatch[2].trim() || undefined,
    };
  }

  return { source: trimmed, repositoryUrl: normalized };
}
