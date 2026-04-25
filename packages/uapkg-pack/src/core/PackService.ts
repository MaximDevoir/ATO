import fs from 'node:fs';
import path from 'node:path';
import {
  createLfsSkippedDiagnostic,
  createNoFilesSelectedDiagnostic,
  createOutFileIsDirectoryDiagnostic,
  createUnresolvedLfsDiagnostic,
  DiagnosticBag,
  ok,
  type Result,
} from '@uapkg/diagnostics';
import Log, { createLogger } from '@uapkg/log';
import semver from 'semver';
import type { PackOptions, PackResult } from '../contracts/PackTypes.js';
import { FileCrawler } from './FileCrawler.js';
import { IgnoreEvaluator } from './IgnoreEvaluator.js';
import { IgnoreRuleLoader } from './IgnoreRuleLoader.js';
import { IntegrityWriter } from './IntegrityWriter.js';
import { LFSPointerDetector } from './LFSPointerDetector.js';
import { PackArtifactExcluder } from './PackArtifactExcluder.js';
import { PackManifestReader } from './PackManifestReader.js';
import { PluginDescriptorGuard } from './PluginDescriptorGuard.js';
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
    private readonly artifactExcluder = new PackArtifactExcluder(),
    private readonly descriptorGuard = new PluginDescriptorGuard(),
    private readonly lfsPointerDetector = new LFSPointerDetector(),
    private readonly tarWriter = new TarArchiveWriter(),
    private readonly integrityWriter = new IntegrityWriter(),
  ) {}

  async pack(options: PackOptions = {}): Promise<Result<PackResult>> {
    const bag = new DiagnosticBag();
    const cwd = options.cwd ?? process.cwd();

    const rootsResult = this.rootResolver.resolve(cwd);
    if (!rootsResult.ok) {
      bag.mergeArray(rootsResult.diagnostics);
      return bag.toFailure();
    }
    const roots = rootsResult.value;

    const manifestResult = this.manifestReader.read(roots.pluginRoot);
    if (!manifestResult.ok) {
      bag.mergeArray(manifestResult.diagnostics);
      return bag.toFailure();
    }
    const manifest = manifestResult.value;

    const rootPrefix = `${manifest.name}-${semver.clean(manifest.version)}`;

    const archivePathResult = this.resolveArchivePath(roots.cwd, options.outFile);
    if (!archivePathResult.ok) {
      bag.mergeArray(archivePathResult.diagnostics);
      return bag.toFailure();
    }
    const archivePath = archivePathResult.value;

    const crawlResult = this.fileCrawler.collect(roots.pluginRoot);
    if (!crawlResult.ok) {
      bag.mergeArray(crawlResult.diagnostics);
      return bag.toFailure();
    }

    const allFiles = crawlResult.value;
    const descriptorResult = this.descriptorGuard.validate(roots.pluginRoot, allFiles);
    if (!descriptorResult.ok) {
      bag.mergeArray(descriptorResult.diagnostics);
      return bag.toFailure();
    }

    const generatedArtifacts = this.artifactExcluder.collect(roots.pluginRoot, archivePath, allFiles);
    const rules = this.ruleLoader.load(roots.gitRoot, roots.pluginRoot);

    const filtered = allFiles.filter((file) => {
      if (generatedArtifacts.has(file.relativePath)) {
        return false;
      }

      const ignored = this.ignoreEvaluator.shouldIgnore(file.relativePath, file.absolutePath, rules);

      if (!ignored) {
        return true;
      }

      return this.isEnforcedInclude(file.relativePath);
    });

    const included: string[] = [];
    let skippedLfs = false;

    for (const file of filtered) {
      if (file.relativePath === 'uapkg.json') {
        included.push(file.relativePath);
        continue;
      }

      if (this.lfsPointerDetector.isPointerFile(file.absolutePath)) {
        if (options.allowMissingLfs === true) {
          bag.add(createLfsSkippedDiagnostic(file.relativePath));
          this.logger.warn(`[LFS] Skipping unresolved LFS file: ${file.relativePath}`);
          skippedLfs = true;
          continue;
        }

        bag.add(createUnresolvedLfsDiagnostic(file.relativePath));
        return bag.toFailure();
      }

      included.push(file.relativePath);
    }

    if (!included.includes('uapkg.json')) {
      included.unshift('uapkg.json');
    }

    const withoutManifest = included.filter((file) => file !== 'uapkg.json');
    if (withoutManifest.length === 0) {
      bag.add(createNoFilesSelectedDiagnostic());
      return bag.toFailure();
    }

    const uniqueIncluded = [...new Set(included)].filter((file) => file !== 'uapkg.lock');
    const sortedFiles = [...uniqueIncluded].sort((left, right) =>
      `${rootPrefix}/${left}`.localeCompare(`${rootPrefix}/${right}`),
    );

    if (skippedLfs) {
      this.logger.warn("[LFS] The package may be incomplete. Run 'git lfs pull' or exclude via '.uapkgignore'.");
    }

    if (options.dryRun === true) {
      for (const relativePath of sortedFiles) {
        this.logger.info(`${rootPrefix}/${relativePath}`);
      }

      return ok({
        pluginRoot: roots.pluginRoot,
        archivePath,
        files: sortedFiles,
        warnings: bag
          .all()
          .filter((d) => d.level === 'warning')
          .map((d) => d.message),
        dryRun: true,
      });
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

    return ok({
      pluginRoot: roots.pluginRoot,
      archivePath,
      integrityPath,
      files: sortedFiles,
      warnings: bag
        .all()
        .filter((d) => d.level === 'warning')
        .map((d) => d.message),
      dryRun: false,
    });
  }

  private resolveArchivePath(cwd: string, outFile?: string): Result<string> {
    const resolved = outFile ? path.resolve(cwd, outFile) : path.resolve(cwd, 'package.tgz');

    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return { ok: false, diagnostics: [createOutFileIsDirectoryDiagnostic(resolved)] };
    }

    return ok(resolved);
  }

  private isEnforcedInclude(relativePath: string): boolean {
    return relativePath === '.uapkg/postinstall.ts' || relativePath === '.uapkg/postinstall.js';
  }
}
