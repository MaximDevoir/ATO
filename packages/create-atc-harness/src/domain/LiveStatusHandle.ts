import type { ReactNode } from 'react';

export interface LiveStatusHandle {
  setStatus(message: string): void;
  addLog(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
  setCustomElement(element: ReactNode | undefined): void;
}
