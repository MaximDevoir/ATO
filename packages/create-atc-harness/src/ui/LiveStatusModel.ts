import type { ReactNode } from 'react';

export interface LiveStatusSnapshot {
  status?: string;
  logs: string[];
  warnings: string[];
  errors: string[];
  customElement?: ReactNode;
}

type Subscriber = (snapshot: LiveStatusSnapshot) => void;

export interface LiveStatusModelLike {
  getSnapshot(): LiveStatusSnapshot;
  subscribe(subscriber: Subscriber): () => void;
  setStatus(status: string): void;
  addLog(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
  setCustomElement(element: ReactNode | undefined): void;
}

export class LiveStatusModel implements LiveStatusModelLike {
  private snapshot: LiveStatusSnapshot = {
    logs: [],
    warnings: [],
    errors: [],
  };
  private readonly subscribers = new Set<Subscriber>();

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  setStatus(status: string) {
    this.snapshot = { ...this.snapshot, status };
    this.emit();
  }

  addLog(message: string) {
    this.snapshot = { ...this.snapshot, logs: [...this.snapshot.logs, message] };
    this.emit();
  }

  addWarning(message: string) {
    this.snapshot = { ...this.snapshot, warnings: [...this.snapshot.warnings, message] };
    this.emit();
  }

  addError(message: string) {
    this.snapshot = { ...this.snapshot, errors: [...this.snapshot.errors, message] };
    this.emit();
  }

  setCustomElement(element: ReactNode | undefined) {
    this.snapshot = { ...this.snapshot, customElement: element };
    this.emit();
  }

  private emit() {
    for (const subscriber of this.subscribers) {
      subscriber(this.snapshot);
    }
  }
}
