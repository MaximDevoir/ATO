import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const files: string[] = [];

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

normalizeLCOV('coverage/lcov.info');
const packagesDir = path.join(ROOT, 'ATO', 'packages');

for (const pkg of fs.readdirSync(packagesDir)) {
  const lcovPath = path.join(packagesDir, pkg, 'coverage', 'lcov.info');

  if (fs.existsSync(lcovPath)) {
    normalizeLCOV(lcovPath, pkg);
  }
}

// Merge reports

if (files.length === 0) {
  console.error('[Coverage] No LCOV files found to merge');
  process.exit(1);
}

const output = path.join(ROOT, 'coverage', 'merged.lcov.info');

console.log('[Coverage] Merging LCOV files:');
for (const f of files) {
  console.log(' -', f);
}

// Quoting paths is required for Windows
const quotedFiles = files.map((f) => `"${f}"`).join(' ');

execSync(`npx lcov-result-merger ${quotedFiles} > "${output}"`, {
  stdio: 'inherit',
});

console.log(`[Coverage] Merged → ${output}`);
