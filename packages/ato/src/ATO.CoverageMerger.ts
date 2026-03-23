import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { checkExistsSync } from './ATO._helpers';

export interface MergedCoverageFile {
  sourceFilePath: string;
  lines: Map<number, number>;
}

export interface MergeCoverageReportsResult {
  outputFilePath: string;
  sourceFileCount: number;
  inputFileCount: number;
}

function resolveCoverageDirectory(projectRoot: string) {
  return path.join(projectRoot, 'coverage', 'atc');
}

function isInfoFile(filePath: string) {
  return filePath.toLowerCase().endsWith('.info');
}

async function collectInfoFiles(directoryPath: string): Promise<string[]> {
  if (!checkExistsSync(directoryPath)) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const discoveredPaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      discoveredPaths.push(...(await collectInfoFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && isInfoFile(entryPath)) {
      discoveredPaths.push(entryPath);
    }
  }

  return discoveredPaths.sort((left, right) => left.localeCompare(right));
}

function ensureCoverageFile(coverageBySourcePath: Map<string, MergedCoverageFile>, sourceFilePath: string) {
  const existing = coverageBySourcePath.get(sourceFilePath);
  if (existing) {
    return existing;
  }

  const created: MergedCoverageFile = {
    sourceFilePath,
    lines: new Map<number, number>(),
  };
  coverageBySourcePath.set(sourceFilePath, created);
  return created;
}

function parseDAEntry(line: string) {
  const payload = line.slice(3).trim();
  const [rawLineNumber, rawHitCount] = payload.split(',', 2);
  const lineNumber = Number.parseInt(rawLineNumber ?? '', 10);
  const hitCount = Number.parseInt(rawHitCount ?? '', 10);
  if (!Number.isInteger(lineNumber) || lineNumber <= 0 || !Number.isInteger(hitCount) || hitCount < 0) {
    return undefined;
  }

  return { lineNumber, hitCount };
}

function mergeLCOVContent(content: string, coverageBySourcePath: Map<string, MergedCoverageFile>) {
  let currentSourceFilePath: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith('SF:')) {
      currentSourceFilePath = line.slice(3);
      ensureCoverageFile(coverageBySourcePath, currentSourceFilePath);
      continue;
    }

    if (line === 'end_of_record') {
      currentSourceFilePath = undefined;
      continue;
    }

    if (!currentSourceFilePath || !line.startsWith('DA:')) {
      continue;
    }

    const parsedEntry = parseDAEntry(line);
    if (!parsedEntry) {
      continue;
    }

    const coverageFile = ensureCoverageFile(coverageBySourcePath, currentSourceFilePath);
    const previousHitCount = coverageFile.lines.get(parsedEntry.lineNumber) ?? 0;
    coverageFile.lines.set(parsedEntry.lineNumber, previousHitCount + parsedEntry.hitCount);
  }
}

function formatMergedLCOV(coverageBySourcePath: Map<string, MergedCoverageFile>) {
  const outputLines: string[] = [];
  const sortedSourcePaths = [...coverageBySourcePath.keys()].sort((left, right) => left.localeCompare(right));

  for (const sourcePath of sortedSourcePaths) {
    const coverageFile = coverageBySourcePath.get(sourcePath);
    if (!coverageFile) {
      continue;
    }

    const sortedLines = [...coverageFile.lines.entries()].sort((left, right) => left[0] - right[0]);
    const linesFound = sortedLines.length;
    const linesHit = sortedLines.filter(([, hitCount]) => hitCount > 0).length;

    outputLines.push('TN:', `SF:${coverageFile.sourceFilePath}`);
    for (const [lineNumber, hitCount] of sortedLines) {
      outputLines.push(`DA:${lineNumber},${hitCount}`);
    }
    outputLines.push(`LF:${linesFound}`, `LH:${linesHit}`, 'end_of_record');
  }

  return outputLines.length > 0 ? `${outputLines.join('\n')}\n` : '';
}

export async function mergeCoverageReports(options: {
  projectRoot: string;
  outputFileName?: string;
}): Promise<MergeCoverageReportsResult | undefined> {
  const coverageDirectory = resolveCoverageDirectory(options.projectRoot);
  if (!checkExistsSync(coverageDirectory)) {
    return undefined;
  }

  const outputFileName = options.outputFileName ?? 'merged.info';
  const outputFilePath = path.join(coverageDirectory, outputFileName);
  const orderedInputFiles = (await collectInfoFiles(coverageDirectory)).filter(
    (filePath) => filePath !== outputFilePath,
  );

  if (orderedInputFiles.length === 0) {
    return undefined;
  }

  const coverageBySourcePath = new Map<string, MergedCoverageFile>();
  for (const inputFilePath of orderedInputFiles) {
    const fileStats = await stat(inputFilePath).catch(() => undefined);
    if (!fileStats?.isFile()) {
      continue;
    }

    const content = await readFile(inputFilePath, 'utf8');
    mergeLCOVContent(content, coverageBySourcePath);
  }

  await writeFile(outputFilePath, formatMergedLCOV(coverageBySourcePath), 'utf8');
  return {
    outputFilePath,
    sourceFileCount: coverageBySourcePath.size,
    inputFileCount: orderedInputFiles.length,
  };
}
