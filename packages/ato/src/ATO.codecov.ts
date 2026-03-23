import { randomInt } from 'node:crypto';
import { mkdirSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { checkExistsSync } from './ATO._helpers';
import { commandExistsSync } from './ATO.helpers';
import { CoordinatorMode } from './ATO.options';

export interface CoverageWrappedLaunch {
  exe: string;
  args: string[];
  reportFilePath: string;
  waitForDescendantProcessPortBinding: boolean;
}

function sanitizeFileName(value: string) {
  return (
    value
      .replaceAll(/[^A-Za-z0-9._-]+/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'coverage'
  );
}

function resolveCoordinatorCoverageLabel(mode: CoordinatorMode) {
  switch (mode) {
    case CoordinatorMode.DedicatedServer:
      return 'dedicated';
    case CoordinatorMode.ListenServer:
      return 'listen';
    case CoordinatorMode.Standalone:
      return 'standalone';
    case CoordinatorMode.PIE:
      return 'pie';
  }
}

function resolveCoverageReportBaseName(coordinatorMode: CoordinatorMode, processLabel: string) {
  const clientMatch = /^CLIENT\s+(\d+)$/i.exec(processLabel.trim());
  if (clientMatch) {
    return `${resolveCoordinatorCoverageLabel(coordinatorMode)}-client-${clientMatch[1]}`;
  }

  return sanitizeFileName(resolveCoordinatorCoverageLabel(coordinatorMode));
}

function resolveCoverageReportFilePath(projectRoot: string, coordinatorMode: CoordinatorMode, processLabel: string) {
  const coverageDirectory = resolveCoverageDirectory(projectRoot);
  const baseName = resolveCoverageReportBaseName(coordinatorMode, processLabel);

  let reportFilePath = '';
  do {
    reportFilePath = path.join(coverageDirectory, `${baseName}-${randomInt(100000, 1000000)}.lcov.info`);
  } while (checkExistsSync(reportFilePath));

  return reportFilePath;
}

function uniquePaths(values: string[]) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = path.normalize(value).toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    results.push(value);
  }

  return results;
}

function pathIsWithin(parentPath: string, candidatePath: string) {
  const relative = path.relative(parentPath, candidatePath);
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function collectPluginBinaryDirectories(projectRoot: string) {
  const pluginRoot = path.join(projectRoot, 'Plugins');
  const directories = [path.join(projectRoot, 'Plugins', '*', 'Binaries', 'Win64')];

  if (!checkExistsSync(pluginRoot)) {
    return directories;
  }

  const stack = [pluginRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const nextPath = path.join(current, entry.name);
      if (entry.name === 'Binaries') {
        directories.push(path.join(nextPath, 'Win64'));
        continue;
      }

      stack.push(nextPath);
    }
  }

  return uniquePaths(directories);
}

function buildProjectModulePatterns(projectRoot: string, executable: string) {
  const projectBinaryDirectories = uniquePaths([
    path.join(projectRoot, 'Binaries', 'Win64'),
    ...collectPluginBinaryDirectories(projectRoot),
  ]);

  const patterns = projectBinaryDirectories.flatMap((directory) => [
    path.join(directory, '*.dll'),
    path.join(directory, '*.exe'),
  ]);
  if (pathIsWithin(projectRoot, executable)) {
    patterns.unshift(executable);
  }

  return uniquePaths(patterns);
}

function buildEngineExclusionPatterns(ueRoot?: string) {
  if (!ueRoot) {
    return [];
  }

  return uniquePaths([
    path.join(ueRoot, 'Binaries', 'Win64', '*.dll'),
    path.join(ueRoot, 'Binaries', 'Win64', '*.exe'),
    path.join(ueRoot, 'Plugins', '*', 'Binaries', 'Win64', '*.dll'),
    path.join(ueRoot, 'Plugins', '*', 'Binaries', 'Win64', '*.exe'),
  ]);
}

function buildSourceDirectories(projectRoot: string) {
  return uniquePaths([path.join(projectRoot, 'Source'), path.join(projectRoot, 'Plugins')]);
}

function resolveCoverageDirectory(projectRoot: string) {
  return path.join(projectRoot, 'coverage', 'atc');
}

export function resolveCodeCoverageExecutable(projectRoot: string) {
  const override = process.env.OPENCPPCOVERAGE_PATH?.trim();
  if (override) {
    return path.resolve(override);
  }

  const localCandidates = [
    path.join(projectRoot, 'OpenCppCoverage.exe'),
    path.join(projectRoot, 'Tools', 'OpenCppCoverage', 'OpenCppCoverage.exe'),
  ];

  return localCandidates.find((candidate) => checkExistsSync(candidate)) ?? 'OpenCppCoverage';
}

export function isCodeCoverageExecutableAvailable(executable: string) {
  if (path.isAbsolute(executable) || executable.includes(path.sep) || executable.toLowerCase().endsWith('.exe')) {
    return checkExistsSync(executable);
  }

  return commandExistsSync(executable);
}

export function buildCoverageWrappedLaunch(options: {
  projectRoot: string;
  ueRoot?: string;
  coordinatorMode: CoordinatorMode;
  processLabel: string;
  executable: string;
  args: string[];
}): CoverageWrappedLaunch {
  const coverageDirectory = resolveCoverageDirectory(options.projectRoot);
  const reportFilePath = resolveCoverageReportFilePath(
    options.projectRoot,
    options.coordinatorMode,
    options.processLabel,
  );
  mkdirSync(coverageDirectory, { recursive: true });

  const coverageArgs = [
    ...buildProjectModulePatterns(options.projectRoot, options.executable).flatMap((modulePattern) => [
      '--modules',
      modulePattern,
    ]),
    ...buildEngineExclusionPatterns(options.ueRoot).flatMap((modulePattern) => ['--excluded_modules', modulePattern]),
    ...buildSourceDirectories(options.projectRoot).flatMap((sourceDirectory) => ['--sources', sourceDirectory]),
    `--export_type=lcov:${reportFilePath}`,
    '--cover_children',
    '--',
    options.executable,
    ...options.args,
  ];

  return {
    exe: resolveCodeCoverageExecutable(options.projectRoot),
    args: coverageArgs,
    reportFilePath,
    waitForDescendantProcessPortBinding: true,
  };
}
