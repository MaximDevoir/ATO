import { DiagnosticBag, ok, type Result } from '@uapkg/diagnostics';
import type { InstallAction } from '../contracts/InstallerTypes.js';
import type { SafetyContext, SafetyPolicy } from '../contracts/SafetyPolicyTypes.js';

/**
 * Per-action safety evaluation result.
 */
export interface SafetyVerdict {
  readonly action: InstallAction;
  readonly blocked: boolean;
  readonly warnings: number;
}

/**
 * Registry of installed safety policies. Pluggable — consumers can register
 * custom policies (e.g. future git-dirty checks) via {@link register}.
 *
 * Evaluation is fail-fast per-action: the first policy that returns
 * `block` stops further policy evaluation for that action.
 */
export class SafetyPolicyRegistry {
  private readonly policies: SafetyPolicy[] = [];

  register(policy: SafetyPolicy): this {
    this.policies.push(policy);
    return this;
  }

  get ids(): readonly string[] {
    return this.policies.map((p) => p.id);
  }

  /**
   * Evaluate all registered policies against every action in a plan. Returns
   * a DiagnosticBag collecting all warnings/blocks, plus the per-action
   * verdict.
   */
  async evaluatePlan(
    manifestRoot: string,
    actions: readonly InstallAction[],
    force: boolean,
  ): Promise<Result<readonly SafetyVerdict[]>> {
    const bag = new DiagnosticBag();
    const verdicts: SafetyVerdict[] = [];

    for (const action of actions) {
      let blocked = false;
      let warnings = 0;

      for (const policy of this.policies) {
        const ctx: SafetyContext = { manifestRoot, action, force };
        const outcome = await policy.evaluate(ctx);
        if (outcome.kind === 'allow') continue;
        bag.mergeArray(outcome.diagnostics);
        if (outcome.kind === 'warn') {
          warnings++;
          continue;
        }
        // block
        blocked = true;
        break;
      }

      verdicts.push({ action, blocked, warnings });
    }

    if (bag.hasErrors()) return bag.toFailure();
    return ok(verdicts);
  }
}

