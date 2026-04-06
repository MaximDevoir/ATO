import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createConfig } from '@uapkg/config';
import Log from '@uapkg/log';
import type { UAPKGConfigAction, UAPKGConfigScope, UAPKGOutputFormat } from '../cli/UAPKGCommandLine';
import type { Command } from './Command';

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
  constructor(private readonly options: ConfigCommandOptions) {}

  async execute() {
    this.validateFlags();

    const config = createConfig({ cwd: this.options.cwd });
    const action = this.options.action;

    switch (action) {
      case 'get': {
        return this.executeGet(config);
      }
      case 'list': {
        return this.executeList(config);
      }
      case 'set': {
        return this.executeSet(config);
      }
      case 'delete': {
        return this.executeDelete(config);
      }
      case 'edit': {
        return this.executeEdit(config);
      }
      default: {
        throw new Error(`[uapkg] Unsupported config action: ${action satisfies never}`);
      }
    }
  }

  private executeGet(config: ReturnType<typeof createConfig>) {
    const pathToProperty = this.options.pathToProperty;
    if (!pathToProperty) {
      throw new Error('[uapkg] config get requires path_to_property');
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

  private executeList(config: ReturnType<typeof createConfig>) {
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

  private executeSet(config: ReturnType<typeof createConfig>) {
    const pathToProperty = this.options.pathToProperty;
    const rawValue = this.options.rawValue;

    if (!pathToProperty || rawValue === undefined) {
      throw new Error('[uapkg] config set requires path_to_property and value');
    }

    const value = this.parseJsonValue(rawValue);
    const plan = config.set(pathToProperty, value, this.options.scope ? { scope: this.options.scope } : {});

    fs.mkdirSync(path.dirname(plan.file), { recursive: true });
    fs.writeFileSync(plan.file, `${JSON.stringify(plan.values, null, 2)}\n`, 'utf8');
    config.reload({ cwd: this.options.cwd });

    return 0;
  }

  private executeDelete(config: ReturnType<typeof createConfig>) {
    const pathToProperty = this.options.pathToProperty;
    if (!pathToProperty) {
      throw new Error('[uapkg] config delete requires path_to_property');
    }

    const plan = config.delete(pathToProperty, this.options.scope ? { scope: this.options.scope } : {});

    fs.mkdirSync(path.dirname(plan.file), { recursive: true });
    fs.writeFileSync(plan.file, `${JSON.stringify(plan.values, null, 2)}\n`, 'utf8');
    config.reload({ cwd: this.options.cwd });

    return 0;
  }

  private executeEdit(config: ReturnType<typeof createConfig>) {
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
      throw new Error(`[uapkg] Failed to open editor '${editor}': ${result.error.message}`);
    }

    if ((result.status ?? 0) !== 0) {
      throw new Error(`[uapkg] Editor exited with status ${result.status}`);
    }

    return 0;
  }

  private validateFlags() {
    if (this.options.showOrigin && this.options.trace) {
      throw new Error('[uapkg] --show-origin and --trace cannot be used together');
    }
  }

  private parseJsonValue(rawValue: string) {
    let value: unknown;

    try {
      value = JSON.parse(rawValue);
    } catch {
      throw new Error('[uapkg] config set value must be valid JSON');
    }

    if (value === null) {
      throw new Error('[uapkg] null is not a valid config value');
    }

    return value;
  }

  private print(value: unknown) {
    if (this.options.output === 'json' || typeof value === 'object') {
      Log.info(JSON.stringify(value, null, 2));
      return;
    }

    Log.info(JSON.stringify(value));
  }
}
