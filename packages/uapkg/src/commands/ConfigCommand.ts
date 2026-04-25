import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  type ConfigInstance,
  createConfig,
  isLeafConfigPath,
  parseConfigCliValue,
  validateConfigPath,
} from '@uapkg/config';
import { createParseErrorDiagnostic, type Diagnostic } from '@uapkg/diagnostics';
import Log from '@uapkg/log';
import type { UAPKGConfigAction, UAPKGConfigScope, UAPKGOutputFormat } from '../cli/UAPKGCommandLine.js';
import { DiagnosticReporter } from '../reporting/DiagnosticReporter.js';
import type { Command } from './Command.js';

export interface ConfigCommandOptions {
  cwd: string;
  action: UAPKGConfigAction;
  pathToProperty?: string;
  rawValue?: string;
  scope?: UAPKGConfigScope;
  output: UAPKGOutputFormat;
  showOrigin: boolean;
  trace: boolean;
}

export class ConfigCommand implements Command {
  private readonly reporter = new DiagnosticReporter();

  constructor(private readonly options: ConfigCommandOptions) {}

  async execute() {
    const flagError = this.validateFlags();
    if (flagError) return this.fail([flagError]);

    const config = createConfig({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());

    const action = this.options.action;
    switch (action) {
      case 'get':
        return this.executeGet(config);
      case 'list':
        return this.executeList(config);
      case 'set':
        return this.executeSet(config);
      case 'delete':
        return this.executeDelete(config);
      case 'edit':
        return this.executeEdit(config);
      default:
        return this.fail([createParseErrorDiagnostic(`Unsupported config action: ${action satisfies never}`)]);
    }
  }

  private executeGet(config: ConfigInstance) {
    const pathToProperty = this.options.pathToProperty;
    if (!pathToProperty) {
      return this.fail([createParseErrorDiagnostic('config get requires path_to_property')]);
    }

    if (this.options.trace) {
      const trace = config.trace(pathToProperty).map((entry) => ({
        ...entry,
        file: entry.file ? config.toDisplayPath(entry.file) : undefined,
      }));
      this.print(trace);
      return 0;
    }

    if (this.options.showOrigin) {
      if (this.options.scope === 'global') {
        const value = config.get(pathToProperty, { scope: 'global' });
        this.print({
          value,
          source: 'global',
          file: value === null ? undefined : config.toDisplayPath(config.getEditTarget({ scope: 'global' })),
        });
        return 0;
      }

      if (this.options.scope === 'local') {
        const value = config.get(pathToProperty, { scope: 'local' });
        const localFile = config.getEditTarget({ scope: 'local' });
        this.print({
          value,
          source: 'local',
          file: value === null ? undefined : config.toDisplayPath(localFile),
        });
        return 0;
      }

      const result = config.getWithOrigin(pathToProperty);
      if (!result) {
        this.print({ value: null, source: 'default' });
        return 0;
      }
      this.print({
        ...result,
        file: result.file ? config.toDisplayPath(result.file) : undefined,
      });
      return 0;
    }

    if (this.options.scope === 'global') {
      this.print(config.get(pathToProperty, { scope: 'global' }));
      return 0;
    }

    if (this.options.scope === 'local') {
      this.print(config.get(pathToProperty, { scope: 'local' }));
      return 0;
    }

    this.print(config.get(pathToProperty));
    return 0;
  }

  private executeList(config: ConfigInstance) {
    if (this.options.scope === 'global') {
      this.print(config.getAll({ scope: 'global' }));
      return 0;
    }

    if (this.options.scope === 'local') {
      this.print(config.getAll({ scope: 'local' }));
      return 0;
    }

    this.print(config.getAll());
    return 0;
  }

  private executeSet(config: ConfigInstance) {
    const pathToProperty = this.options.pathToProperty;
    const rawValue = this.options.rawValue;

    if (!pathToProperty || rawValue === undefined) {
      return this.fail([createParseErrorDiagnostic('config set requires path_to_property and value')]);
    }

    const pathValidation = validateConfigPath(pathToProperty);
    if (!pathValidation.ok) return this.fail(pathValidation.diagnostics);

    if (!isLeafConfigPath(pathToProperty)) {
      return this.fail([
        createParseErrorDiagnostic(
          `config set only supports leaf properties. Use a concrete path like "${pathToProperty}.<field>".`,
        ),
      ]);
    }

    const parsedValue = parseConfigCliValue(pathToProperty, rawValue);
    if (!parsedValue.ok) return this.fail(parsedValue.diagnostics);

    const plan = config.set(pathToProperty, parsedValue.value, this.options.scope ? { scope: this.options.scope } : {});
    if (!plan.ok) return this.fail(plan.diagnostics);

    fs.mkdirSync(path.dirname(plan.value.file), { recursive: true });
    fs.writeFileSync(plan.value.file, `${JSON.stringify(plan.value.values, null, 2)}\n`, 'utf8');
    config.reload({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());
    return 0;
  }

  private executeDelete(config: ConfigInstance) {
    const pathToProperty = this.options.pathToProperty;
    if (!pathToProperty) {
      return this.fail([createParseErrorDiagnostic('config delete requires path_to_property')]);
    }

    const plan = config.delete(pathToProperty, this.options.scope ? { scope: this.options.scope } : {});
    if (!plan.ok) return this.fail(plan.diagnostics);

    fs.mkdirSync(path.dirname(plan.value.file), { recursive: true });
    fs.writeFileSync(plan.value.file, `${JSON.stringify(plan.value.values, null, 2)}\n`, 'utf8');
    config.reload({ cwd: this.options.cwd });
    this.reportIfText(config.getDiagnostics());
    return 0;
  }

  private executeEdit(config: ConfigInstance) {
    const filePath = config.getEditTarget(this.options.scope ? { scope: this.options.scope } : {});

    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '{}\n', 'utf8');
    }

    const editorValue = config.get('editor');
    const editor = typeof editorValue === 'string' ? editorValue : process.platform === 'win32' ? 'notepad.exe' : 'vi';

    const result = spawnSync(editor, [filePath], {
      cwd: this.options.cwd,
      shell: true,
      stdio: 'inherit',
    });

    if (result.error) {
      return this.fail([createParseErrorDiagnostic(`Failed to open editor '${editor}': ${result.error.message}`)]);
    }

    if ((result.status ?? 0) !== 0) {
      return this.fail([createParseErrorDiagnostic(`Editor exited with status ${result.status}`)]);
    }

    return 0;
  }

  private validateFlags(): Diagnostic | null {
    if (this.options.showOrigin && this.options.trace) {
      return createParseErrorDiagnostic('--show-origin and --trace cannot be used together');
    }
    return null;
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

  private print(value: unknown) {
    if (this.options.output === 'json' || typeof value === 'object') {
      Log.info(JSON.stringify(value, null, 2));
      return;
    }

    Log.info(JSON.stringify(value));
  }
}
