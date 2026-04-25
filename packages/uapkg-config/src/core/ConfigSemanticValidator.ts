import {
  createConfigInvalidValueDiagnostic,
  createConfigUnresolvedDefaultRegistryDiagnostic,
  type Diagnostic,
  DiagnosticBag,
} from '@uapkg/diagnostics';
import { configSchema } from '../schema/configSchema.js';

/**
 * Runs post-merge semantic checks and narrow-rule validation.
 */
export class ConfigSemanticValidator {
  public validate(merged: Record<string, unknown>): readonly Diagnostic[] {
    const bag = new DiagnosticBag();
    bag.mergeArray(this.validateCrossFieldRules(merged));
    bag.mergeArray(this.validateNarrowSchemaRules(merged));
    return bag.all();
  }

  private validateCrossFieldRules(merged: Record<string, unknown>): readonly Diagnostic[] {
    const bag = new DiagnosticBag();
    const registry = merged.registry;
    const registries = merged.registries;
    if (typeof registry === 'string' && this.isRecord(registries) && !(registry in registries)) {
      bag.add(createConfigUnresolvedDefaultRegistryDiagnostic(registry));
    }

    return bag.all();
  }

  private validateNarrowSchemaRules(merged: Record<string, unknown>): readonly Diagnostic[] {
    const bag = new DiagnosticBag();
    const validation = configSchema.safeParse(merged);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const issuePath = issue.path.length > 0 ? issue.path.join('.') : '$';
        bag.add(createConfigInvalidValueDiagnostic(issuePath, issue.message));
      }
    }

    return bag.all();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
