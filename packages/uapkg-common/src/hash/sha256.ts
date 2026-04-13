import { createHash } from 'node:crypto';

/**
 * Compute a SHA-256 hex digest of the given input.
 */
export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Compute a SHA-256 hex digest prefixed with the algorithm identifier.
 * Format: `sha256:<hex>`
 */
export function sha256Prefixed(input: string | Buffer): string {
  return `sha256:${sha256(input)}`;
}
