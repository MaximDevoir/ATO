#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline';
import dotenv from 'dotenv';

async function main() {
  /* =========================
   * LOAD ENV (from cwd)
   * ========================= */

  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  /* =========================
   * HELPERS
   * ========================= */
  function assertUProjectInCwd(): void {
    const cwd = process.cwd();

    const entries = fs.readdirSync(cwd);
    const uprojects = entries.filter((f) => f.endsWith('.uproject'));

    if (uprojects.length === 0) {
      throw new Error(
        `[BuildGraph] No .uproject found in current directory: ${cwd}\n\n` +
          `👉 Fix:\n` +
          `  - Run this command from your project root\n`,
      );
    }

    if (uprojects.length > 1) {
      console.warn(`[BuildGraph] Multiple .uproject files found in ${cwd}, using ${uprojects[0]}`);
    }
  }

  function normalize(p: string): string {
    return p.replace(/\\/g, '/');
  }

  function exists(p: string): boolean {
    try {
      fs.accessSync(p);
      return true;
    } catch {
      return false;
    }
  }

  function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(
        `[BuildGraph] Missing required env: ${name}\n\n` +
          `👉 Fix:\n` +
          `  1. Add it to your .env file\n` +
          `  2. Or pass it inline:\n\n` +
          `     ${name}=<value> npx tsx BuildGraph/GenerateBuildGraphFromTemplate.ts\n`,
      );
    }

    return normalize(value);
  }

  /* =========================
   * FIND .UPROJECT
   * ========================= */

  function findUProject(startDir: string): string | null {
    let current = path.resolve(startDir);

    while (true) {
      const entries = fs.readdirSync(current);

      const uprojects = entries.filter((f) => f.endsWith('.uproject'));

      if (uprojects.length > 0) {
        if (uprojects.length > 1) {
          console.warn(`[BuildGraph] Multiple .uproject files found in ${current}, using ${uprojects[0]}`);
        }

        return normalize(path.join(current, uprojects[0]));
      }

      const parent = path.dirname(current);
      if (parent === current) break;

      current = parent;
    }

    return null;
  }

  /* =========================
   * RESOLVE CORE INPUTS
   * ========================= */

  let ProjectFile: string;

  if (process.env.PROJECT_FILE) {
    ProjectFile = normalize(process.env.PROJECT_FILE);
  } else {
    assertUProjectInCwd();

    const found = findUProject(process.cwd());

    if (!found) {
      throw new Error(
        '[BuildGraph] Could not find .uproject. ' + 'Set PROJECT_FILE or run from within a project directory.',
      );
    }

    ProjectFile = found;
  }

  const EngineDir = requireEnv('ENGINE_DIR');

  /* =========================
   * DERIVED VALUES
   * ========================= */

  const ProjectDir = normalize(path.dirname(ProjectFile));

  const ProjectName = path.basename(ProjectFile).replace(/\.uproject$/i, '');

  /* =========================
   * PLATFORM DETECTION
   * Compute the BuildGraph platform aliases used in the template. Users may override
   * via the PLATFORM env variable (examples: Win64, Linux, LinuxArm64, Mac).
   * Defaults are inferred from process.platform and process.arch.
   * ========================= */

  // Update: resolve platforms should use COMPILE_PLATFORM env and return CompilePlatform + CookPlatform only
  function resolvePlatforms(): {
    CompilePlatform: string;
    CookPlatform: string;
  } {
    // prefer explicit COMPILE_PLATFORM env; fall back to existing detection if not provided
    const envCompilePlatform = process.env.COMPILE_PLATFORM?.trim();
    if (envCompilePlatform) {
      switch (envCompilePlatform) {
        case 'Win64':
          return { CompilePlatform: 'Win64', CookPlatform: 'WindowsServer' };
        case 'Linux':
          return { CompilePlatform: 'Linux', CookPlatform: 'LinuxServer' };
        case 'LinuxArm64':
          return { CompilePlatform: 'LinuxArm64', CookPlatform: 'LinuxServer' };
        default:
          // if unknown, continue to automatic detection below
          break;
      }
    }

    // Auto-detect from runtime platform
    if (process.platform === 'win32') {
      return { CompilePlatform: 'Win64', CookPlatform: 'WindowsServer' };
    }

    if (process.platform === 'darwin') {
      return { CompilePlatform: 'Mac', CookPlatform: 'Mac' };
    }

    // Linux / other unix-like
    if (process.platform === 'linux') {
      if (process.arch === 'arm64') {
        return { CompilePlatform: 'LinuxArm64', CookPlatform: 'LinuxServer' };
      }

      return { CompilePlatform: 'Linux', CookPlatform: 'LinuxServer' };
    }

    // Fallback to Linux-style
    return { CompilePlatform: 'Linux', CookPlatform: 'LinuxServer' };
  }

  const platforms = resolvePlatforms();

  // If COOK_PLATFORM is explicitly provided, normalize/override cook platform only
  if (process.env.COOK_PLATFORM) {
    const cook = process.env.COOK_PLATFORM.trim();
    switch (cook.toLowerCase()) {
      case 'windows':
        platforms.CookPlatform = 'WindowsServer';
        break;
      case 'linux':
        platforms.CookPlatform = 'LinuxServer';
        break;
      case 'mac':
      case 'macos':
        platforms.CookPlatform = 'Mac';
        break;
      default:
        console.warn(`[BuildGraph] Unrecognized COOK_PLATFORM value: ${cook}. Ignoring.`);
    }
  }

  /* =========================
   * Schema Detection
   * ========================= */
  function findBuildGraphSchema(engineDir: string): string | null {
    // 1. Explicit override via env
    const override = process.env.SCHEMA_PATH;

    if (override) {
      const normalized = normalize(override);

      if (!exists(normalized)) {
        console.warn(`[BuildGraph] SCHEMA_PATH is set but file does not exist: ${normalized}`);
      } else {
        console.log(`[BuildGraph] Using schema override: ${normalized}`);
        return normalized;
      }
    }

    // 2. Auto-detect from EngineDir
    const autoPath = path.join(engineDir, 'Build', 'Graph', 'Schema.xsd');

    if (exists(autoPath)) {
      const normalized = normalize(autoPath);
      console.log(`[BuildGraph] Using detected schema: ${normalized}`);
      return normalized;
    }

    // 3. Not found → fallback
    console.log(`[BuildGraph] Schema.xsd not found (override or EngineDir), using base namespace only`);

    return null;
  }

  const schemaPath = findBuildGraphSchema(EngineDir);

  const SchemaLocation = schemaPath
    ? `http://www.epicgames.com/BuildGraph ${schemaPath}`
    : `http://www.epicgames.com/BuildGraph`;

  /* =========================
   * TEMPLATE RESOLUTION
   * ========================= */

  // IMPORTANT: resolve relative to real script location (ATO)
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);

  const resolvedScriptDir = process.platform === 'win32' ? scriptDir.replace(/^\/([A-Za-z]:)/, '$1') : scriptDir;

  const templatePath = path.resolve(resolvedScriptDir, 'ATCTests.template.xml');

  // Output always goes to project (cwd)
  const outputPath = path.resolve(process.cwd(), 'BuildGraph', 'ATCTests.generated.xml');

  if (!exists(templatePath)) {
    throw new Error(`[BuildGraph] Template not found: ${templatePath}`);
  }

  const template = fs.readFileSync(templatePath, 'utf-8');

  /* =========================
   * TEMPLATE VALUES
   * ========================= */

  const values = {
    ProjectFile,
    ProjectDir,
    ProjectName,
    EngineDir,
    CompilePlatform: platforms.CompilePlatform,
    // Derive per-mode cook platforms so standalone/listen use non-server cooks
    // while dedicated uses the server cook variant.
    CookPlatformStandalone: (() => {
      const c = platforms.CookPlatform;
      return c.endsWith('Server') ? c.replace(/Server$/, '') : c;
    })(),
    CookPlatformDedicated: (() => {
      const c = platforms.CookPlatform;
      return c.endsWith('Server') ? c : `${c}Server`;
    })(),
    SchemaLocation,
  };

  /* =========================
   * TEMPLATE ENGINE
   * ========================= */

  const result = template.replace(/{{(.*?)}}/g, (_, key) => {
    const value = (values as unknown as string)[key];

    if (value === undefined) {
      throw new Error(`[BuildGraph] Missing template value: ${key}`);
    }

    return String(value);
  });

  /* =========================
   * WRITE OUTPUT
   * ========================= */

  // If the output already exists, prompt the user to confirm overwrite unless FORCE_OVERWRITE=1
  if (fs.existsSync(outputPath) && process.env.FORCE_OVERWRITE !== '1') {
    if (!process.stdin.isTTY) {
      console.log(
        '[BuildGraph] Output already exists and running in non-interactive mode. Set FORCE_OVERWRITE=1 to overwrite automatically.',
      );
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer: string = await new Promise((resolve) => {
      rl.question(`[BuildGraph] Output already exists at ${outputPath}. Overwrite? (y/N): `, (ans) =>
        resolve(ans ?? ''),
      );
    });
    rl.close();

    const normalized = (answer || '').trim().toLowerCase();
    if (normalized !== 'y' && normalized !== 'yes') {
      console.log('[BuildGraph] Aborted by user; existing generated file was not overwritten.');
      return;
    }
  }

  fs.writeFileSync(outputPath, result);

  console.log(`[BuildGraph] Generated: ${outputPath}`);

  /* =========================
   * DEBUG OUTPUT
   * ========================= */

  console.log(`[BuildGraph] Resolved config:`);
  console.log(`  ProjectFile: ${ProjectFile}`);
  console.log(`  ProjectDir: ${ProjectDir}`);
  console.log(`  ProjectName: ${ProjectName}`);
  console.log(`  EngineDir: ${EngineDir}`);
  console.log(`  SchemaXSD: ${SchemaLocation}`);
  console.log(`  CompilePlatform: ${platforms.CompilePlatform}`);
  console.log(`  CookPlatformStandalone: ${values.CookPlatformStandalone}`);
  console.log(`  CookPlatformDedicated: ${values.CookPlatformDedicated}`);
  if (platforms.CookPlatform === 'Mac') {
    console.warn(``);
    console.warn(
      `  Cooking has limitations on macOS. Testing outside of PIE may fail due to uncooked builds. Let me know if you have any information on this topic.`,
    );
    console.warn(``);
  }
}

main().catch((err) => {
  console.error('');
  console.error('❌ BuildGraph generation failed');
  console.error('');

  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }

  console.error('');
  process.exit(1);
});
