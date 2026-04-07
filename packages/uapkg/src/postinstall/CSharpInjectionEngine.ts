import type { ParsedCSharpFile } from './CSharpStructures.js';
import { MarkerBlockService } from './MarkerBlockService.js';

export class CSharpInjectionEngine {
  private readonly markerBlock = new MarkerBlockService();

  applyIncludes(source: string, pluginName: string, includesContent: string, zone: string) {
    const withoutOwnedBlock = this.markerBlock.stripOwnedBlock(source, pluginName, zone);
    const includeBlock = this.markerBlock.createBlock(pluginName, zone, includesContent);
    const usingMatches = [...withoutOwnedBlock.matchAll(/^[ \t]*using\s+[^;]+;\s*$/gm)];
    if (usingMatches.length === 0) {
      return `${includeBlock}\n${withoutOwnedBlock}`.trimStart();
    }

    const lastUsing = usingMatches[usingMatches.length - 1];
    const lastUsingIndex = (lastUsing.index ?? 0) + lastUsing[0].length;
    return `${withoutOwnedBlock.slice(0, lastUsingIndex)}\n${includeBlock}\n${withoutOwnedBlock.slice(lastUsingIndex).trimStart()}`;
  }

  applyClassWrapper(parsed: ParsedCSharpFile, pluginName: string, wrapperContent: string, zone: string) {
    const classStart = parsed.classInfo.classOpenBraceIndex + 1;
    const classEnd = parsed.classInfo.classCloseBraceIndex;
    const classBody = parsed.source.slice(classStart, classEnd);
    const stripped = this.markerBlock.stripOwnedBlock(classBody, pluginName, zone).trimStart();
    const indent = this.detectClassMemberIndent(parsed.source, parsed.classInfo.classOpenBraceIndex);
    const block = this.markerBlock.createBlock(pluginName, zone, wrapperContent, indent);
    const nextBody = `\n${block}\n\n${stripped}`.replace(/\n{3,}/g, '\n\n');
    return `${parsed.source.slice(0, classStart)}${nextBody}${parsed.source.slice(classEnd)}`;
  }

  applyConstructorCall(parsed: ParsedCSharpFile, pluginName: string, callExpression: string, zone: string) {
    const bodyStart = parsed.constructorInfo.bodyOpenBraceIndex + 1;
    const bodyEnd = parsed.constructorInfo.bodyCloseBraceIndex;
    const body = parsed.source.slice(bodyStart, bodyEnd);
    const withoutOwnedBlock = this.markerBlock.stripOwnedBlock(body, pluginName, zone).trimStart();
    const indent = this.detectConstructorIndent(parsed.source, parsed.constructorInfo.bodyOpenBraceIndex);
    const block = this.markerBlock.createBlock(pluginName, zone, `${callExpression};`, indent);
    const nextBody = `\n${block}\n${withoutOwnedBlock.length > 0 ? `\n${withoutOwnedBlock}` : ''}`.replace(
      /\n{3,}/g,
      '\n\n',
    );
    return `${parsed.source.slice(0, bodyStart)}${nextBody}${parsed.source.slice(bodyEnd)}`;
  }

  private detectClassMemberIndent(source: string, classOpenBraceIndex: number) {
    const lineStart = source.lastIndexOf('\n', classOpenBraceIndex);
    const classLine = source.slice(lineStart + 1, classOpenBraceIndex);
    const classIndent = classLine.match(/^\s*/)?.[0] ?? '';
    return `${classIndent}    `;
  }

  private detectConstructorIndent(source: string, constructorOpenBraceIndex: number) {
    const lineStart = source.lastIndexOf('\n', constructorOpenBraceIndex);
    const constructorLine = source.slice(lineStart + 1, constructorOpenBraceIndex);
    const constructorIndent = constructorLine.match(/^\s*/)?.[0] ?? '';
    return `${constructorIndent}    `;
  }
}
