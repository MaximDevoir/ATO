export type CSharpFileKind = 'module' | 'target';

export interface ParsedClass {
  readonly className: string;
  readonly classKeywordIndex: number;
  readonly classOpenBraceIndex: number;
  readonly classCloseBraceIndex: number;
}

export interface ParsedConstructor {
  readonly signatureIndex: number;
  readonly bodyOpenBraceIndex: number;
  readonly bodyCloseBraceIndex: number;
}

export interface ParsedCSharpFile {
  readonly kind: CSharpFileKind;
  readonly classInfo: ParsedClass;
  readonly constructorInfo: ParsedConstructor;
  readonly source: string;
}
