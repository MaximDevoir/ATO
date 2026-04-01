import { render } from 'ink';
// biome-ignore lint/correctness/noUnusedImports: React is required at runtime for JSX
import React from 'react';
import { CreateATCHarnessApp } from './CreateATCHarnessApp';
import { LiveStatusModel } from './LiveStatusModel';

export class HarnessTerminal {
  private readonly model = new LiveStatusModel();
  private inkApp?: ReturnType<typeof render>;

  constructor(private readonly isInteractive = Boolean(process.stdout.isTTY && process.stdin.isTTY)) {}

  start() {
    if (!this.isInteractive || this.inkApp) {
      return;
    }

    this.inkApp = render(<CreateATCHarnessApp model={this.model} />);
  }

  stop() {
    if (!this.inkApp) {
      return;
    }
    this.inkApp.unmount();
    this.inkApp = undefined;
  }

  getModel() {
    return this.model;
  }
}
