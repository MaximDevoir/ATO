/**
 * Low-level marker-block primitives.
 *
 * A marker block has the form:
 *
 * ```
 * <indent>// UAPKG-BEGIN <pluginName>:<zone>
 * <indent><content...>
 * <indent>// UAPKG-END <pluginName>:<zone>
 * ```
 *
 * Blocks are *owned* by a `(pluginName, zone)` pair — only the owning pair's
 * blocks are ever rewritten. Behavior mirrors the legacy `MarkerBlockService`
 * so existing host-project files stay stable across the rewrite.
 */
export class MarkerBlockService {
  public makeBegin(pluginName: string, zone: string): string {
    return `// UAPKG-BEGIN ${pluginName}:${zone}`;
  }

  public makeEnd(pluginName: string, zone: string): string {
    return `// UAPKG-END ${pluginName}:${zone}`;
  }

  public createBlock(pluginName: string, zone: string, content: string, indent = ''): string {
    const begin = `${indent}${this.makeBegin(pluginName, zone)}`;
    const end = `${indent}${this.makeEnd(pluginName, zone)}`;
    const lines = content
      .trim()
      .split(/\r?\n/)
      .map((line) => `${indent}${line}`.replace(/[ \t]+$/g, ''));
    return `${begin}\n${lines.join('\n')}\n${end}`;
  }

  public stripOwnedBlock(source: string, pluginName: string, zone: string): string {
    const begin = this.escapeForRegex(this.makeBegin(pluginName, zone));
    const end = this.escapeForRegex(this.makeEnd(pluginName, zone));
    const pattern = new RegExp(`^[ \\t]*${begin}[\\s\\S]*?^[ \\t]*${end}\\s*\\r?\\n?`, 'gm');
    return source.replace(pattern, '');
  }

  public containsOwnedBlock(source: string, pluginName: string, zone: string): boolean {
    const begin = this.escapeForRegex(this.makeBegin(pluginName, zone));
    return new RegExp(`^[ \\t]*${begin}$`, 'm').test(source);
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
