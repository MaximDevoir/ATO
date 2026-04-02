export class MarkerBlockService {
  makeBegin(pluginName: string, zone: string) {
    return `// UAPM-BEGIN ${pluginName}:${zone}`;
  }

  makeEnd(pluginName: string, zone: string) {
    return `// UAPM-END ${pluginName}:${zone}`;
  }

  createBlock(pluginName: string, zone: string, content: string, indent = '') {
    const begin = `${indent}${this.makeBegin(pluginName, zone)}`;
    const end = `${indent}${this.makeEnd(pluginName, zone)}`;
    const lines = content
      .trim()
      .split(/\r?\n/)
      .map((line) => `${indent}${line}`.replace(/[ \t]+$/g, ''));
    return `${begin}\n${lines.join('\n')}\n${end}`;
  }

  stripOwnedBlock(source: string, pluginName: string, zone: string) {
    const begin = this.escapeForRegex(this.makeBegin(pluginName, zone));
    const end = this.escapeForRegex(this.makeEnd(pluginName, zone));
    const pattern = new RegExp(`^[ \\t]*${begin}[\\s\\S]*?^[ \\t]*${end}\\s*\\r?\\n?`, 'gm');
    return source.replace(pattern, '');
  }

  containsOwnedBlock(source: string, pluginName: string, zone: string) {
    const begin = this.escapeForRegex(this.makeBegin(pluginName, zone));
    return new RegExp(`^[ \\t]*${begin}$`, 'm').test(source);
  }

  private escapeForRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
