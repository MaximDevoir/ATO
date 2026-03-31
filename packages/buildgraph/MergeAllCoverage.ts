import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let index = 0;
const ROOT = process.cwd();
const stagingDir = path.join(ROOT, 'coverage', 'individual');

const files: string[] = [];

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

function normalizeIntegrationPath(filePath: string): string {
  filePath = filePath.replace(/\\/g, '/');

  // Remove leading ATO/
  if (filePath.startsWith('ATO/')) {
    return filePath.slice(4);
  }

  return filePath;
}

function normalizePackagePath(filePath: string, pkgName: string): string {
  filePath = filePath.replace(/\\/g, '/');

  // Already normalized
  if (filePath.startsWith('packages/')) {
    return filePath;
  }

  if (filePath.startsWith('src/')) {
    return `packages/${pkgName}/${filePath}`;
  }

  return filePath;
}

function normalizeLCOV(input: string, pkgName?: string) {
  const content = fs.readFileSync(input, 'utf-8');
  files.push(input);
  const normalized = content
    .split('\n')
    .map((line) => {
      if (!line.startsWith('SF:')) return line;

      let filePath = line.slice(3);

      if (pkgName) {
        filePath = normalizePackagePath(filePath, pkgName);
      } else {
        filePath = normalizeIntegrationPath(filePath);
      }

      return `SF:${filePath}`;
    })
    .join('\n');

  fs.writeFileSync(input, normalized);
  console.log(`[Coverage] Normalized: ${input}`);
}

normalizeLCOV('coverage/coverage-final.json');
stage('coverage/coverage-final.json');

const packagesDir = path.join(ROOT, 'ATO', 'packages');

for (const pkg of fs.readdirSync(packagesDir)) {
  const lcovPath = path.join(packagesDir, pkg, 'coverage', 'coverage-final.json');

  if (fs.existsSync(lcovPath)) {
    normalizeLCOV(lcovPath, pkg);
    stage(lcovPath);
  }
}

// Merge reports
console.log('[Coverage] Merging LCOV files:');
for (const f of files) {
  console.log(' -', f);
}

if (files.length === 0) {
  console.error('[Coverage] No LCOV files found to merge');
  process.exit(1);
}

const output = path.join(ROOT, 'coverage', 'merged.coverage-final.json');

function stage(file: string) {
  const dest = path.join(stagingDir, `${String(index++)}-coverage-final.json`);
  fs.copyFileSync(file, dest);

  console.log(`[Coverage] Staged: ${file} → ${dest}`);
}

function toPosix(p: string) {
  return p.replace(/\\/g, '/');
}

// Quoting paths is required for Windows
const pattern = toPosix(path.join(stagingDir, '*/coverage-final.json'));

console.log(pattern);
execSync(`npx lcov-result-merger ${pattern} "${output}"`, { stdio: 'inherit' });

const mergedJson = path.join(ROOT, 'coverage', 'merged.json');

execSync(`npx nyc merge "./coverage/individual" "${mergedJson}"`, { stdio: 'inherit' });

console.log(`[Coverage] Merged → ${output}`);

// Prepare nyc output dir
const nycOutputDir = path.join(ROOT, 'coverage', '.nyc_output');
fs.rmSync(nycOutputDir, { recursive: true, force: true });
fs.mkdirSync(nycOutputDir, { recursive: true });

fs.copyFileSync(mergedJson, path.join(nycOutputDir, 'out.json'));

// Generate LCOV
execSync(`npx nyc report --reporter=lcov --temp-dir coverage --report-dir coverage/merged`, { stdio: 'inherit' });

normalizeLCOV('coverage/merged/lcov.info');

const stats = fs.statSync(path.join(ROOT, 'coverage', 'merged', 'lcov.info'));

if (stats.size === 0) {
  console.error('[Coverage] ❌ Merged LCOV is empty (0 bytes)');
  process.exit(1);
}

console.log(`[Coverage] ✅ Merged size: ${stats.size} bytes`);
