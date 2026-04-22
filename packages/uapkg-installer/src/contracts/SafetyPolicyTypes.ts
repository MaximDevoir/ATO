import type { Diagnostic } from '@uapkg/diagnostics';
import type { InstallAction } from './InstallerTypes.js';

/**
 * Stable identifier for a built-in safety policy.
 *
 * This is NOT a closed enum — consumers MAY register their own policies via
 * {@link SafetyPolicyRegistry.register}. Built-in identifiers are reserved.
 */
export type BuiltInSafetyPolicyId = 'no-marker' | 'plugin-manifest-path';

/**
 * Outcome of evaluating a single safety policy against one action.
 */
export type SafetyEvaluation =
  | { readonly kind: 'allow' }
  | { readonly kind: 'block'; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: 'warn'; readonly diagnostics: readonly Diagnostic[] };

/**
 * Context passed to every policy on each evaluation. Policies do not share
 * state and must not mutate the context.
 */
export interface SafetyContext {
  readonly manifestRoot: string;
  readonly action: InstallAction;
  readonly force: boolean;
}

/**
 * Contract every safety policy implements.
 *
 * A policy is a stateless, injectable function-object with an identifier so
 * failures can be cited in diagnostics and `--force` messages.
 */
export interface SafetyPolicy {
  readonly id: string;
  evaluate(context: SafetyContext): Promise<SafetyEvaluation>;
}
