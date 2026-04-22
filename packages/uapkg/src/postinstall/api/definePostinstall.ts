import type { PostinstallDefinition } from './PostinstallDsl.js';

/**
 * Identity helper used in user-authored `.uapkg/postinstall.ts` files:
 *
 * ```ts
 * import { definePostinstall } from 'uapkg/postinstall';
 * export default definePostinstall({
 *   setupModules: { classBody: '...' },
 * });
 * ```
 *
 * At runtime this is the identity function; at edit time it gives authors
 * full TypeScript autocomplete/validation against {@link PostinstallDefinition}.
 * The loader validates the shape regardless of whether the author used this
 * helper, so it is purely ergonomic.
 */
export function definePostinstall(definition: PostinstallDefinition): PostinstallDefinition {
  return definition;
}
