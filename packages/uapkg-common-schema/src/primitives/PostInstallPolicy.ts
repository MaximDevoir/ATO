import { z } from 'zod';
import type { Brand } from '../brand/Brand.js';

/**
 * PostInstallPolicy controls whether plugin-authored postinstall hooks are
 * allowed to mutate the host Unreal project on install/update.
 *
 * - `allow`: postinstall hooks execute after extraction.
 * - `deny`: postinstall hooks are skipped; an info diagnostic is emitted.
 *
 * The `prompt` variant is intentionally unsupported — uapkg commands must
 * remain non-interactive so they can run unattended in CI.
 */
export type PostInstallPolicy = Brand<'allow' | 'deny', 'PostInstallPolicy'>;

export const PostInstallPolicySchema = z.enum(['allow', 'deny']).transform((v) => v as PostInstallPolicy);

export const POSTINSTALL_POLICY_DEFAULT: PostInstallPolicy = 'deny' as PostInstallPolicy;
