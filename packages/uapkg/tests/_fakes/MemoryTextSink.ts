import type { TextSink } from '../../src/reporting/TextSink.js';

/**
 * Test-only `TextSink` implementation that captures every write for assertions.
 * One instance per sink — do not share between stdout/stderr in a single test.
 */
export class MemoryTextSink implements TextSink {
  public readonly lines: string[] = [];
  public readonly writes: string[] = [];

  public writeLine(line: string): void {
    this.lines.push(line);
  }

  public write(text: string): void {
    this.writes.push(text);
  }

  public joined(): string {
    return this.lines.join('\n');
  }
}

