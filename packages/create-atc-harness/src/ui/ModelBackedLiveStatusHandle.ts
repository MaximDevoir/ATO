import type { ReactNode } from 'react';
import type { LiveStatusHandle } from '../domain/LiveStatusHandle';
import type { LiveStatusModelLike } from './LiveStatusModel';

export class ModelBackedLiveStatusHandle implements LiveStatusHandle {
  constructor(private readonly model: LiveStatusModelLike) {}

  setStatus(message: string) {
    this.model.setStatus(message);
  }

  addLog(message: string) {
    this.model.addLog(message);
  }

  addWarning(message: string) {
    this.model.addWarning(message);
  }

  addError(message: string) {
    this.model.addError(message);
  }

  setCustomElement(element: ReactNode | undefined) {
    this.model.setCustomElement(element);
  }
}
