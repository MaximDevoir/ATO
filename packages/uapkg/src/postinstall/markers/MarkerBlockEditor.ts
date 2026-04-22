import {
  type Result,
  ok,
  fail,
  createPostinstallMarkerCorruptDiagnostic,
} from '@uapkg/diagnostics';
import { MarkerBlockService } from './MarkerBlockService.js';
import { MarkerIntegrityValidator } from './MarkerIntegrityValidator.js';

/**
 * Higher-level idempotent wrapper around {@link MarkerBlockService}.
 *
 * - `upsert`: remove any existing owned block and re-insert fresh content.
 *   Idempotent: calling twice with the same input yields the same result.
 * - `remove`: strip the owned block if present; no-op otherwise.
 * - `validate`: detect corruption (orphaned/nested markers) in the source for
 *   the owning `(pluginName, zone)` pair. Returns a `POSTINSTALL_MARKER_CORRUPT`
 *   diagnostic on failure; never throws.
 *
 * Injectors compose this helper to achieve "edit once, safe to re-run" semantics.
 */
export class MarkerBlockEditor {
  public constructor(
    private readonly service: MarkerBlockService = new MarkerBlockService(),
    private readonly integrity: MarkerIntegrityValidator = new MarkerIntegrityValidator(),
  ) {}

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

  /**
   * Validates that the source contains a well-formed marker block for the
   * owning `(pluginName, zone)` pair. Returns `Result.ok` when clean; returns
   * `Result.fail` with a `POSTINSTALL_MARKER_CORRUPT` diagnostic otherwise.
   */
  public validate(
    source: string,
    pluginName: string,
    zone: string,
    filePath: string,
  ): Result<void> {
    const result = this.integrity.validate(source, pluginName, zone);
    if (result.ok) return ok(undefined);
    return fail([
      createPostinstallMarkerCorruptDiagnostic(pluginName, filePath, result.reason),
    ]);
  }
}


