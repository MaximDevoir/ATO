import fs from 'node:fs';
import os from 'node:os';
import * as path from 'node:path';

export interface FileSystemService {
  exists(filePath: string): boolean;
  ensureDir(directoryPath: string): void;
  listEntries(directoryPath: string): string[];
  createTempDir(prefix: string): string;
  removeDir(directoryPath: string): void;
  copyDir(sourceDirectory: string, destinationDirectory: string): void;
  resolve(...segments: string[]): string;
}

export class NodeFileSystemService implements FileSystemService {
  exists(filePath: string) {
    return fs.existsSync(filePath);
  }

  ensureDir(directoryPath: string) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  listEntries(directoryPath: string) {
    return fs.readdirSync(directoryPath);
  }

  createTempDir(prefix: string) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  }

  removeDir(directoryPath: string) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }

  copyDir(sourceDirectory: string, destinationDirectory: string) {
    fs.cpSync(sourceDirectory, destinationDirectory, { recursive: true, force: true });
  }

  resolve(...segments: string[]) {
    return path.resolve(...segments);
  }
}
