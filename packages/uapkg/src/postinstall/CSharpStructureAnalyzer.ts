import type { CSharpFileKind, ParsedClass, ParsedConstructor, ParsedCSharpFile } from './CSharpStructures.js';
import { PrettyParseError } from './PrettyParseError.js';

const CLASS_REGEX = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^{\r\n]+)/g;

export class CSharpStructureAnalyzer {
  parseModule(filePath: string, source: string): ParsedCSharpFile {
    return this.parseFile('module', filePath, source, 'ModuleRules', 'ReadOnlyTargetRules');
  }

  parseTarget(filePath: string, source: string): ParsedCSharpFile {
    const parsed = this.parseFile('target', filePath, source, 'TargetRules', 'TargetInfo');
    if (!/\bType\s*=\s*TargetType\.[A-Za-z_][A-Za-z0-9_]*\s*;/.test(source)) {
      throw new PrettyParseError(filePath, 'TargetRules file missing `Type = TargetType.X;` assignment', source, 0);
    }
    return parsed;
  }

  private parseFile(
    kind: CSharpFileKind,
    filePath: string,
    source: string,
    expectedBaseClass: string,
    expectedConstructorArgType: string,
  ): ParsedCSharpFile {
    const matchingClasses = this.findClassesByBase(source, expectedBaseClass);
    if (matchingClasses.length !== 1) {
      throw new PrettyParseError(
        filePath,
        `Expected exactly one class extending ${expectedBaseClass}, found ${matchingClasses.length}`,
        source,
        matchingClasses[0]?.classKeywordIndex ?? 0,
      );
    }
    const classInfo = matchingClasses[0];
    const constructorInfo = this.findConstructor(filePath, source, classInfo, expectedConstructorArgType);
    return {
      kind,
      classInfo,
      constructorInfo,
      source,
    };
  }

  private findClassesByBase(source: string, expectedBaseClass: string): ParsedClass[] {
    const classes: ParsedClass[] = [];
    for (const match of source.matchAll(CLASS_REGEX)) {
      const className = match[1];
      const inheritance = match[2] ?? '';
      const inheritsExpected = inheritance
        .split(',')
        .map((item) => item.trim())
        .some((item) => item === expectedBaseClass);
      if (!inheritsExpected || !className) {
        continue;
      }

      const classKeywordIndex = match.index ?? 0;
      const classOpenBraceIndex = source.indexOf('{', classKeywordIndex);
      if (classOpenBraceIndex < 0) {
        continue;
      }
      const classCloseBraceIndex = this.findMatchingBrace(source, classOpenBraceIndex);
      classes.push({
        className,
        classKeywordIndex,
        classOpenBraceIndex,
        classCloseBraceIndex,
      });
    }
    return classes;
  }

  private findConstructor(
    filePath: string,
    source: string,
    classInfo: ParsedClass,
    expectedConstructorArgType: string,
  ): ParsedConstructor {
    const classBody = source.slice(classInfo.classOpenBraceIndex + 1, classInfo.classCloseBraceIndex);
    const signatureRegex = new RegExp(
      `\\bpublic\\s+${classInfo.className}\\s*\\(\\s*${expectedConstructorArgType}\\s+Target\\s*\\)\\s*:\\s*base\\s*\\(\\s*Target\\s*\\)`,
      'g',
    );

    const matches = [...classBody.matchAll(signatureRegex)];
    if (matches.length !== 1) {
      throw new PrettyParseError(
        filePath,
        `Expected exactly one constructor signature for ${classInfo.className}(${expectedConstructorArgType} Target) : base(Target), found ${matches.length}`,
        source,
        classInfo.classKeywordIndex,
      );
    }

    const signatureRelativeIndex = matches[0].index ?? 0;
    const signatureIndex = classInfo.classOpenBraceIndex + 1 + signatureRelativeIndex;
    const bodyOpenBraceIndex = source.indexOf('{', signatureIndex);
    if (bodyOpenBraceIndex < 0) {
      throw new PrettyParseError(filePath, 'Constructor body opening brace not found', source, signatureIndex);
    }
    const bodyCloseBraceIndex = this.findMatchingBrace(source, bodyOpenBraceIndex);
    return {
      signatureIndex,
      bodyOpenBraceIndex,
      bodyCloseBraceIndex,
    };
  }

  private findMatchingBrace(source: string, openIndex: number) {
    let depth = 0;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = openIndex; i < source.length; i += 1) {
      const current = source[i];
      const next = source[i + 1];
      const prev = source[i - 1];

      if (inSingleLineComment) {
        if (current === '\n') {
          inSingleLineComment = false;
        }
        continue;
      }
      if (inMultiLineComment) {
        if (prev === '*' && current === '/') {
          inMultiLineComment = false;
        }
        continue;
      }
      if (inSingleQuote) {
        if (current === "'" && prev !== '\\') {
          inSingleQuote = false;
        }
        continue;
      }
      if (inDoubleQuote) {
        if (current === '"' && prev !== '\\') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (current === '/' && next === '/') {
        inSingleLineComment = true;
        i += 1;
        continue;
      }
      if (current === '/' && next === '*') {
        inMultiLineComment = true;
        i += 1;
        continue;
      }
      if (current === "'") {
        inSingleQuote = true;
        continue;
      }
      if (current === '"') {
        inDoubleQuote = true;
        continue;
      }
      if (current === '{') {
        depth += 1;
      } else if (current === '}') {
        depth -= 1;
        if (depth === 0) {
          return i;
        }
      }
    }
    throw new Error('[uapkg] Unbalanced braces in C# file');
  }
}
