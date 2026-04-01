export interface FileSystem {
  exists(filePath: string): boolean;
  isDirectory(filePath: string): boolean;
  readText(filePath: string): string;
  writeText(filePath: string, content: string): void;
  ensureDirectory(directoryPath: string): void;
  listFiles(directoryPath: string): string[];
  listEntries(directoryPath: string): string[];
  copyDirectory(sourceDirectory: string, destinationDirectory: string): void;
  removeDirectory(directoryPath: string): void;
  createTemporaryDirectory(prefix: string): string;
}
