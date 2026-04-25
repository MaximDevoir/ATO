import fs from 'node:fs';
import path from 'node:path';
import { type ConfigInstance, createConfig } from '@uapkg/config';
import { createParseErrorDiagnostic, type Diagnostic } from '@uapkg/diagnostics';
import Log from '@uapkg/log';
import type { UAPKGConfigScope, UAPKGOutputFormat, UAPKGRegistryAction } from '../cli/UAPKGCommandLine.js';
import { DiagnosticReporter } from '../reporting/DiagnosticReporter.js';
import type { Command } from './Command.js';

export interface RegistryCommandOptions {
  cwd: string;
  action: UAPKGRegistryAction;
  name?: string;
  url?: string;
  refType?: 'branch' | 'tag' | 'rev';
  refValue?: string;
  scope?: UAPKGConfigScope;
  output: UAPKGOutputFormat;
}

export class RegistryCommand implements Command {
  private readonly reporter = new DiagnosticReporter();

  constructor(private readonly options: RegistryCommandOptions) {}

  public async execute(): Promise<number> {
    const config = createConfig({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());

    switch (this.options.action) {
      case 'list':
        return this.executeList(config);
      case 'add':
        return this.executeAdd(config);
      case 'remove':
        return this.executeRemove(config);
      case 'use':
        return this.executeUse(config);
      default:
        return this.fail([
          createParseErrorDiagnostic(`Unsupported registry action: ${this.options.action satisfies never}`),
        ]);
    }
  }

  private executeList(config: ConfigInstance): number {
    const registries = this.options.scope
      ? config.get('registries', { scope: this.options.scope })
      : config.get('registries');
    this.print(registries ?? {});
    return 0;
  }

  private executeAdd(config: ConfigInstance): number {
    const name = this.options.name;
    const url = this.options.url;
    if (!name || !url) {
      return this.fail([createParseErrorDiagnostic('registry add requires <name> and <url>.')]);
    }

    const ref = this.resolveRef();

    const setUrl = config.set(`registries.${name}.url`, url, this.scopeOptions());
    if (!setUrl.ok) return this.fail(setUrl.diagnostics);
    this.persistPlan(setUrl.value.file, setUrl.value.values);

    const setRef = config.set(`registries.${name}.ref`, ref, this.scopeOptions());
    if (!setRef.ok) return this.fail(setRef.diagnostics);
    this.persistPlan(setRef.value.file, setRef.value.values);

    config.reload({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());
    this.print({
      action: 'add',
      name,
      url,
      ref,
      scope: this.options.scope ?? 'auto',
    });
    return 0;
  }

  private executeRemove(config: ConfigInstance): number {
    const name = this.options.name;
    if (!name) {
      return this.fail([createParseErrorDiagnostic('registry remove requires <name>.')]);
    }

    const plan = config.delete(`registries.${name}`, this.scopeOptions());
    if (!plan.ok) return this.fail(plan.diagnostics);
    this.persistPlan(plan.value.file, plan.value.values);

    config.reload({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());
    this.print({ action: 'remove', name, scope: this.options.scope ?? 'auto' });
    return 0;
  }

  private executeUse(config: ConfigInstance): number {
    const name = this.options.name;
    if (!name) {
      return this.fail([createParseErrorDiagnostic('registry use requires <name>.')]);
    }

    const plan = config.set('registry', name, this.scopeOptions());
    if (!plan.ok) return this.fail(plan.diagnostics);
    this.persistPlan(plan.value.file, plan.value.values);

    config.reload({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());
    this.print({ action: 'use', name, scope: this.options.scope ?? 'auto' });
    return 0;
  }

  private resolveRef(): { type: 'branch' | 'tag' | 'rev'; value: string } {
    const type = this.options.refType ?? 'branch';
    const value = this.options.refValue ?? 'main';
    return { type, value };
  }

  private scopeOptions(): { scope?: UAPKGConfigScope } {
    return this.options.scope ? { scope: this.options.scope } : {};
  }

  private persistPlan(filePath: string, values: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
  }

  private fail(diagnostics: readonly Diagnostic[]): number {
    this.reporter.reportAll(diagnostics);
    return 1;
  }

  private reportIfText(diagnostics: readonly Diagnostic[]): void {
    if (this.options.output === 'text') {
      this.reporter.reportAll(diagnostics);
    }
  }

  private print(value: unknown): void {
    if (this.options.output === 'json' || typeof value === 'object') {
      Log.info(JSON.stringify(value, null, 2));
      return;
    }
    Log.info(JSON.stringify(value));
  }
}
