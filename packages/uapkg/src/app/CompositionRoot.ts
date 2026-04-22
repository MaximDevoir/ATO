import { ConfigInstance } from '@uapkg/config';
import { Installer } from '@uapkg/installer';
import { PackageManifest } from '@uapkg/package-manifest';
import { RegistryCore } from '@uapkg/registry-core';
import { DiagnosticReporter } from '../reporting/DiagnosticReporter.js';
import { JsonReporter } from '../reporting/JsonReporter.js';
import { PostinstallOrchestrator } from '../postinstall/runner/PostinstallOrchestrator.js';

export interface CompositionRootOptions {
  readonly cwd: string;
}

/**
 * Central dependency-injection root for the uapkg CLI.
 *
 * One instance is created per CLI invocation. It lazily constructs shared
 * services so commands that don't need them pay nothing. Every service this
 * root owns is either a pure facade (`PackageManifest`, `RegistryCore`) or a
 * stateless collaborator — there is no mutable shared state outside the
 * wrapped config/registry caches.
 *
 * Dependency graph (no cycles):
 *
 *   ConfigInstance ──► RegistryCore ──► PackageManifest
 *                     │                   │
 *                     └──► Installer ◄────┘
 *                          PostinstallOrchestrator
 *                          DiagnosticReporter / JsonReporter
 */
export class CompositionRoot {
  private _config?: InstanceType<typeof ConfigInstance>;
  private _registryCore?: RegistryCore;
  private _packageManifest?: PackageManifest;
  private _installer?: Installer;
  private _postinstall?: PostinstallOrchestrator;
  private _diagnostics?: DiagnosticReporter;
  private _json?: JsonReporter;

  public constructor(private readonly options: CompositionRootOptions) {}

  public get cwd(): string {
    return this.options.cwd;
  }

  public get config(): InstanceType<typeof ConfigInstance> {
    if (!this._config) {
      this._config = new ConfigInstance({ cwd: this.options.cwd });
    }
    return this._config;
  }

  public get registryCore(): RegistryCore {
    if (!this._registryCore) {
      // RegistryCore accepts a duck-typed config surface; ConfigInstance has
      // wider return types, so cast through `unknown` to satisfy the narrower
      // structural type.
      this._registryCore = new RegistryCore({
        configInstance: this.config as unknown as { get: (p?: string) => unknown; getAll: () => Record<string, unknown>; getDefaultRegistry: () => { url: string; ref: { type: string; value: string } } | null },
      });
    }
    return this._registryCore;
  }

  public get packageManifest(): PackageManifest {
    if (!this._packageManifest) {
      this._packageManifest = new PackageManifest({
        manifestRoot: this.options.cwd,
        registryCore: this.registryCore,
        configInstance: this.config,
      });
    }
    return this._packageManifest;
  }

  public get installer(): Installer {
    if (!this._installer) {
      this._installer = new Installer({
        registryCore: this.registryCore,
        config: this.config,
      });
    }
    return this._installer;
  }

  public get postinstall(): PostinstallOrchestrator {
    if (!this._postinstall) {
      this._postinstall = new PostinstallOrchestrator();
    }
    return this._postinstall;
  }

  public get diagnostics(): DiagnosticReporter {
    if (!this._diagnostics) {
      this._diagnostics = new DiagnosticReporter();
    }
    return this._diagnostics;
  }

  public get json(): JsonReporter {
    if (!this._json) {
      this._json = new JsonReporter();
    }
    return this._json;
  }
}




