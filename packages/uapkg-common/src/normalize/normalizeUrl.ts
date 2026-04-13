/**
 * Normalize a registry URL for identity hashing.
 *
 * - Remove trailing `/`
 * - Remove `.git` suffix
 * - Lowercase the host portion
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Remove trailing slash(es)
  normalized = normalized.replace(/\/+$/, '');

  // Remove .git suffix
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4);
  }

  // Lowercase the host (protocol + host)
  try {
    const parsed = new URL(normalized);
    parsed.hostname = parsed.hostname.toLowerCase();
    // Reconstruct without trailing slash that URL adds
    normalized = parsed.toString().replace(/\/+$/, '');
  } catch {
    // If not a valid URL, just lowercase the whole thing as a best effort
    normalized = normalized.toLowerCase();
  }

  return normalized;
}
