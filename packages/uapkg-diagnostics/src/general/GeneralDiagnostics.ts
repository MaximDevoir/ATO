import type { DiagnosticBase } from '../base/Diagnostic.js';

// ---------------------------------------------------------------------------
// General-purpose diagnostic codes
// ---------------------------------------------------------------------------

/** Generic JSON or data parse error. */
export type ParseErrorDiagnostic = DiagnosticBase<
  'PARSE_ERROR',
  {
    readonly filePath?: string;
    readonly reason: string;
  }
>;

/** File system I/O error. */
export type IoErrorDiagnostic = DiagnosticBase<
  'IO_ERROR',
  {
    readonly path: string;
    readonly reason: string;
  }
>;

/** Catch-all for truly unexpected situations (should be rare). */
export type UnknownErrorDiagnostic = DiagnosticBase<
  'UNKNOWN_ERROR',
  {
    readonly reason: string;
  }
>;

/** Union of all general diagnostics. */
export type GeneralDiagnostic = ParseErrorDiagnostic | IoErrorDiagnostic | UnknownErrorDiagnostic;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createParseErrorDiagnostic(reason: string, filePath?: string): ParseErrorDiagnostic {
  return {
    level: 'error',
    code: 'PARSE_ERROR',
    message: filePath ? `Parse error in "${filePath}": ${reason}.` : `Parse error: ${reason}.`,
    hint: 'Ensure the input is well-formed.',
    data: { filePath, reason },
  };
}

export function createIoErrorDiagnostic(path: string, reason: string): IoErrorDiagnostic {
  return {
    level: 'error',
    code: 'IO_ERROR',
    message: `I/O error at "${path}": ${reason}.`,
    hint: 'Check file permissions and that the path exists.',
    data: { path, reason },
  };
}

export function createUnknownErrorDiagnostic(reason: string): UnknownErrorDiagnostic {
  return {
    level: 'error',
    code: 'UNKNOWN_ERROR',
    message: `An unexpected error occurred: ${reason}.`,
    hint: 'If this persists, please report a bug.',
    data: { reason },
  };
}
