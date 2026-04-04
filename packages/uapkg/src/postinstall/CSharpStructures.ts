export type CSharpFileKind = 'module' | 'target';

export interface ParsedClass {
  className: string;
  classKeywordIndex: number;
  classOpenBraceIndex: number;
  classCloseBraceIndex: number;
}

export interface ParsedConstructor {
  signatureIndex: number;
  bodyOpenBraceIndex: number;
  bodyCloseBraceIndex: number;
}

export interface ParsedCSharpFile {
  kind: CSharpFileKind;
  classInfo: ParsedClass;
  constructorInfo: ParsedConstructor;
  source: string;
}
