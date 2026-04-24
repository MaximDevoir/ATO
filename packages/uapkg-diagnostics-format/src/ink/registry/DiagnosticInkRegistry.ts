import type { DiagnosticCode } from '@uapkg/diagnostics';
import type {
  DiagnosticBodyComponent,
  DiagnosticInkComponentMap,
  IDiagnosticInkRegistry,
} from '../contracts/InkTypes.js';

/**
 * Lookup service for Ink diagnostic-body components.
 *
 * - One-shot register: seed with a map at construction.
 * - Extensible: callers can `register(code, component)` for bespoke overrides.
 *
 * The registry only *resolves* components — the composing {@link DiagnosticView}
 * is responsible for fallback behavior when `resolve()` returns undefined.
 */
export class DiagnosticInkRegistry implements IDiagnosticInkRegistry {
  private readonly components: Map<DiagnosticCode, DiagnosticBodyComponent>;

  public constructor(seed: DiagnosticInkComponentMap = {}) {
    this.components = new Map();
    for (const key of Object.keys(seed) as DiagnosticCode[]) {
      const component = seed[key];
      if (component) this.components.set(key, component);
    }
  }

  public register(code: DiagnosticCode, component: DiagnosticBodyComponent): void {
    this.components.set(code, component);
  }

  public resolve(code: DiagnosticCode): DiagnosticBodyComponent | undefined {
    return this.components.get(code);
  }
}

/**
 * Factory helper so consumers don't have to `new` the class directly.
 */
export function createInkRegistry(seed?: DiagnosticInkComponentMap): DiagnosticInkRegistry {
  return new DiagnosticInkRegistry(seed);
}
