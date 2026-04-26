import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';
import type { FileSystem } from './FileSystem.js';

export class NodeFileSystem implements FileSystem {
  exists(filePath: string) {
    return fs.existsSync(filePath);
  }

  isDirectory(filePath: string) {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  }

  readText(filePath: string) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  writeText(filePath: string, content: string) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  ensureDirectory(directoryPath: string) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  listFiles(directoryPath: string) {
    return fs.readdirSync(directoryPath);
  }

  listEntries(directoryPath: string) {
    return fs.readdirSync(directoryPath).map((entry) => path.join(directoryPath, entry));
  }

  copyDirectory(sourceDirectory: string, destinationDirectory: string) {
    fs.cpSync(sourceDirectory, destinationDirectory, { recursive: true, force: true });
  }

  removeDirectory(directoryPath: string) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }

  createTemporaryDirectory(prefix: string) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  }
}
