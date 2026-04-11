import fs from 'node:fs';
import path from 'node:path';
import Log, { createLogger } from '@uapkg/log';
import semver from 'semver';
import type { PackOptions, PackResult } from '../contracts/PackTypes.js';
import { FileCrawler } from './FileCrawler.js';
import { IgnoreEvaluator } from './IgnoreEvaluator.js';
import { IgnoreRuleLoader } from './IgnoreRuleLoader.js';
import { IntegrityWriter } from './IntegrityWriter.js';
import { LFSPointerDetector } from './LFSPointerDetector.js';
import { PackManifestReader } from './PackManifestReader.js';
import { PluginRootResolver } from './PluginRootResolver.js';
import { TarArchiveWriter } from './TarArchiveWriter.js';

export class PackService {
  private readonly logger = createLogger({ context: 'pack' });

  constructor(
    private readonly rootResolver = new PluginRootResolver(),
    private readonly manifestReader = new PackManifestReader(),
    private readonly fileCrawler = new FileCrawler(),
    private readonly ruleLoader = new IgnoreRuleLoader(),
    private readonly ignoreEvaluator = new IgnoreEvaluator(),
    private readonly lfsPointerDetector = new LFSPointerDetector(),
    private readonly tarWriter = new TarArchiveWriter(),
    private readonly integrityWriter = new IntegrityWriter(),
  ) {}

  async pack(options: PackOptions = {}): Promise<PackResult> {
    const cwd = options.cwd ?? process.cwd();
    const roots = this.rootResolver.resolve(cwd);
    const manifest = this.manifestReader.read(roots.pluginRoot);

    const rootPrefix = `${manifest.name}-${semver.clean(manifest.version)}`;
    const archivePath = this.resolveArchivePath(roots.cwd, options.outFile);

    const allFiles = this.fileCrawler.collect(roots.pluginRoot);
    const rules = this.ruleLoader.load(roots.gitRoot, roots.pluginRoot);

    const filtered = allFiles.filter((file) => {
      const ignored = this.ignoreEvaluator.shouldIgnore(file.relativePath, file.absolutePath, rules);

      if (!ignored) {
        return true;
      }

      return this.isEnforcedInclude(file.relativePath);
    });

    const warnings: string[] = [];
    const included: string[] = [];
    let skippedLfs = false;

    for (const file of filtered) {
      if (file.relativePath === 'uapkg.json') {
        included.push(file.relativePath);
        continue;
      }

      if (this.lfsPointerDetector.isPointerFile(file.absolutePath)) {
        if (options.allowMissingLfs === true) {
          const warning = `[LFS] Skipping unresolved LFS file: ${file.relativePath}`;
          warnings.push(warning);
          this.logger.warn(warning);
          skippedLfs = true;
          continue;
        }

        throw new Error(
          `[uapkg] Unresolved LFS pointer file: ${file.relativePath}. Run 'git lfs pull' or use --allow-missing-lfs.`,
        );
      }

      included.push(file.relativePath);
    }

    if (!included.includes('uapkg.json')) {
      included.unshift('uapkg.json');
    }

    const withoutManifest = included.filter((file) => file !== 'uapkg.json');
    if (withoutManifest.length === 0) {
      throw new Error('[uapkg] No files selected for packing after ignore/LFS resolution');
    }

    const uniqueIncluded = [...new Set(included)].filter((file) => file !== 'uapkg.lock');
    const sortedFiles = [...uniqueIncluded].sort((left, right) =>
      `${rootPrefix}/${left}`.localeCompare(`${rootPrefix}/${right}`),
    );

    if (skippedLfs) {
      const lfsWarning = "[LFS] The package may be incomplete. Run 'git lfs pull' or exclude via '.uapkgignore'.";
      warnings.push(lfsWarning);
      this.logger.warn(lfsWarning);
    }

    if (options.dryRun === true) {
      for (const relativePath of sortedFiles) {
        this.logger.info(`${rootPrefix}/${relativePath}`);
      }

      return {
        pluginRoot: roots.pluginRoot,
        archivePath,
        files: sortedFiles,
        warnings,
        dryRun: true,
      };
    }

    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    await this.tarWriter.write({
      archivePath,
      pluginRoot: roots.pluginRoot,
      rootPrefix,
      files: sortedFiles,
    });

    const integrityPath = this.integrityWriter.write(archivePath);
    Log.info(`[uapkg] Packed ${sortedFiles.length} files into ${archivePath}`);

    return {
      pluginRoot: roots.pluginRoot,
      archivePath,
      integrityPath,
      files: sortedFiles,
      warnings,
      dryRun: false,
    };
  }

  private resolveArchivePath(cwd: string, outFile?: string) {
    const resolved = outFile ? path.resolve(cwd, outFile) : path.resolve(cwd, 'package.tgz');

    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      throw new Error('[uapkg] --outFile must be a file path, not a directory');
    }

    return resolved;
  }

  private isEnforcedInclude(relativePath: string): boolean {
    return relativePath === '.uapkg/postinstall.ts' || relativePath === '.uapkg/postinstall.js';
  }
}
