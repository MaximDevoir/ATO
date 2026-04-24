import type { Diagnostic, DiagnosticCode } from '@uapkg/diagnostics';
import type { ComponentType } from 'react';

/**
 * Props every family-body component receives. Each component renders only
 * the **body** of a diagnostic — icon, code header, and hint are rendered
 * by {@link DiagnosticView}. Bodies are pure (data-in → element-out) and
 * must never touch config, fs, or stdout.
 */
export interface DiagnosticBodyProps {
  readonly diagnostic: Diagnostic;
}

/** A React/Ink component that renders a diagnostic body. */
export type DiagnosticBodyComponent = ComponentType<DiagnosticBodyProps>;

/**
 * Map of diagnostic code → body component. Any code **not** present in the
 * map falls back to {@link PlainTextBody}, which renders the same prose
 * `formatPlainText` would emit — just wrapped in `<Text>`.
 */
export type DiagnosticInkComponentMap = Partial<Record<DiagnosticCode, DiagnosticBodyComponent>>;

/**
 * Contract for a lookup service that maps diagnostic codes to Ink bodies.
 *
 * The registry is the Ink analog of `FormatterRegistry` — same spirit
 * (code → renderer), different codomain (React element vs. string).
 */
export interface IDiagnosticInkRegistry {
  register(code: DiagnosticCode, component: DiagnosticBodyComponent): void;
  resolve(code: DiagnosticCode): DiagnosticBodyComponent | undefined;
}
