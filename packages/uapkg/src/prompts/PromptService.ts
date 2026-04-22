// ---------------------------------------------------------------------------
// PromptService — abstraction used by interactive commands (e.g. `init`).
//
// Split from the Ink implementation so that test environments can substitute
// a non-interactive stub without pulling React/Ink into the test harness.
// ---------------------------------------------------------------------------

export interface SelectOption {
  label: string;
  value: string;
}

export interface PromptService {
  select(message: string, options: SelectOption[], fallbackValue: string): Promise<string>;
  text(message: string, initialValue: string): Promise<string>;
}

