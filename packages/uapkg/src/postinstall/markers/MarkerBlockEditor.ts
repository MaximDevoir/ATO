import { MarkerBlockService } from './MarkerBlockService.js';

/**
 * Higher-level idempotent wrapper around {@link MarkerBlockService}.
 *
 * - `upsert`: remove any existing owned block and re-insert fresh content.
 *   Idempotent: calling twice with the same input yields the same result.
 * - `remove`: strip the owned block if present; no-op otherwise.
 *
 * Injectors compose this helper to achieve "edit once, safe to re-run" semantics.
 */
export class MarkerBlockEditor {
  public constructor(private readonly service: MarkerBlockService = new MarkerBlockService()) {}

  public upsert(source: string, pluginName: string, zone: string, content: string, indent = ''): string {
    const stripped = this.service.stripOwnedBlock(source, pluginName, zone);
    const block = this.service.createBlock(pluginName, zone, content, indent);
    return `${stripped.trimEnd()}\n${block}\n`;
  }

  public remove(source: string, pluginName: string, zone: string): string {
    return this.service.stripOwnedBlock(source, pluginName, zone);
  }

  public contains(source: string, pluginName: string, zone: string): boolean {
    return this.service.containsOwnedBlock(source, pluginName, zone);
  }
}

